import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute, detectBinary } from './shared';

export const read_file = tool({
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
});
