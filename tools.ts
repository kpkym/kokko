import { tool } from 'ai';
import { z } from 'zod';
import { mkdir, readdir, stat } from 'node:fs/promises';

const LIMITS = {
  maxLines: 2000,
  maxBytes: 262_144,
  maxWriteBytes: 10_485_760,
  maxEntries: 1000,
  maxBashBytes: 30_000,
  defaultTimeoutMs: 120_000,
  maxTimeoutMs: 600_000,
} as const;

function requireAbsolute(path: string): void {
  if (!path.startsWith('/')) {
    throw new Error(`path must be absolute (got: ${path})`);
  }
}

function detectBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

export const tools = {
  get_current_time: tool({
    description: 'Get the current time as an ISO 8601 string.',
    inputSchema: z.object({}),
    execute: async () => new Date().toISOString(),
  }),

  read_file: tool({
    description:
      'Read a UTF-8 text file. Supports a 1-based line window via offset/limit. ' +
      'Refuses binary files. Caps at 2000 lines / 256KB; truncation is noted in a bracketed header line.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the file.'),
      offset: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('1-based starting line number.'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Maximum number of lines to return.'),
    }),
    execute: async ({ path, offset, limit }) => {
      requireAbsolute(path);
      const file = Bun.file(path);
      const raw = new Uint8Array(await file.arrayBuffer());

      const head = raw.subarray(0, Math.min(raw.length, 8192));
      if (detectBinary(head)) {
        throw new Error(`read_file: binary files are not supported (path=${path})`);
      }

      const totalBytes = raw.length;
      const byteTruncated = totalBytes > LIMITS.maxBytes;
      const readable = byteTruncated ? raw.subarray(0, LIMITS.maxBytes) : raw;
      const text = new TextDecoder('utf-8').decode(readable);
      const lines = text.split('\n');
      if (text.endsWith('\n')) lines.pop();
      const totalLines = lines.length;

      const start = (offset ?? 1) - 1;
      const count = limit ?? LIMITS.maxLines;
      const end = Math.min(start + count, totalLines);
      const body = lines.slice(start, end).join('\n');

      let header = '';
      if (byteTruncated) {
        header = `[truncated: ${LIMITS.maxBytes} of ${totalBytes} bytes]\n`;
      }
      if (start > 0 || end < totalLines) {
        header += `[truncated: showing lines ${start + 1}-${end} of ${totalLines}]\n`;
      }
      return header + body;
    },
  }),

  write_file: tool({
    description:
      'Write (or overwrite) a UTF-8 text file at an absolute path. Creates parent directories. Rejects content >10MB.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path.'),
      content: z.string(),
    }),
    execute: async ({ path, content }) => {
      requireAbsolute(path);
      const bytes = new TextEncoder().encode(content);
      if (bytes.length > LIMITS.maxWriteBytes) {
        throw new Error(
          `write_file: content exceeds ${LIMITS.maxWriteBytes} bytes (got ${bytes.length})`,
        );
      }
      const lastSlash = path.lastIndexOf('/');
      if (lastSlash > 0) {
        await mkdir(path.substring(0, lastSlash), { recursive: true });
      }
      await Bun.write(path, content);
      return `wrote ${bytes.length} bytes to ${path}`;
    },
  }),

  edit_file: tool({
    description:
      'Edit a UTF-8 text file by exact string replacement. old_string must appear exactly once unless replace_all=true.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to an existing file.'),
      old_string: z.string().min(1).describe('Exact substring to replace (must be non-empty).'),
      new_string: z.string().describe('Replacement text.'),
      replace_all: z
        .boolean()
        .optional()
        .describe('If true, replace every occurrence; otherwise require a unique match.'),
    }),
    execute: async ({ path, old_string, new_string, replace_all }) => {
      requireAbsolute(path);
      if (old_string.length === 0) {
        throw new Error('edit_file: old_string must be non-empty');
      }
      if (old_string === new_string) {
        throw new Error('edit_file: old_string and new_string are identical');
      }
      const file = Bun.file(path);
      if (!(await file.exists())) {
        throw new Error(`edit_file: file not found (path=${path})`);
      }
      const content = await file.text();
      if (new TextEncoder().encode(content).length > LIMITS.maxWriteBytes) {
        throw new Error(
          `edit_file: file exceeds ${LIMITS.maxWriteBytes} bytes`,
        );
      }

      let count = 0;
      let idx = 0;
      while ((idx = content.indexOf(old_string, idx)) !== -1) {
        count++;
        idx += old_string.length;
      }
      if (count === 0) {
        throw new Error('edit_file: old_string not found');
      }
      if (!replace_all && count > 1) {
        throw new Error(
          `edit_file: old_string appears ${count} times; provide more context or set replace_all=true`,
        );
      }

      const next = content.split(old_string).join(new_string);

      await Bun.write(path, next);
      const replacements = replace_all ? count : 1;
      return `edited ${path} (${replacements} replacement(s))`;
    },
  }),

  list_dir: tool({
    description:
      'List direct children of a directory at an absolute path. Appends / to dirs, @ to symlinks. Caps at 1000 entries.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to a directory.'),
    }),
    execute: async ({ path }) => {
      requireAbsolute(path);
      const st = await stat(path);
      if (!st.isDirectory()) {
        throw new Error(`list_dir: not a directory (path=${path})`);
      }
      const entries = await readdir(path, { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      const total = entries.length;
      if (total === 0) return '(empty)';
      const capped = entries.slice(0, LIMITS.maxEntries);
      const lines = capped.map((e) => {
        if (e.isDirectory()) return e.name + '/';
        if (e.isSymbolicLink()) return e.name + '@';
        return e.name;
      });
      const header =
        total > LIMITS.maxEntries
          ? `[truncated: ${LIMITS.maxEntries} of ${total} entries]\n`
          : '';
      return header + lines.join('\n');
    },
  }),

  glob: tool({
    description:
      'Match files by glob pattern under an absolute base directory. Returns absolute paths. Caps at 1000 matches.',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern (e.g. "**/*.ts").'),
      cwd: z.string().describe('Absolute base directory to scan from.'),
    }),
    execute: async ({ pattern, cwd }) => {
      requireAbsolute(cwd);
      const g = new Bun.Glob(pattern);
      const prefix = cwd.endsWith('/') ? cwd : cwd + '/';
      const results: string[] = [];
      let hitCap = false;
      for await (const rel of g.scan({ cwd, onlyFiles: true, dot: false })) {
        if (results.length >= LIMITS.maxEntries) {
          hitCap = true;
          break;
        }
        results.push(prefix + rel);
      }
      if (results.length === 0) return '(no matches)';
      results.sort();
      const header = hitCap
        ? `[truncated: ${LIMITS.maxEntries} of ${LIMITS.maxEntries}+ matches]\n`
        : '';
      return header + results.join('\n');
    },
  }),
};
