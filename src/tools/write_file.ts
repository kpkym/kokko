import { tool } from 'ai';
import { z } from 'zod';
import { mkdir } from 'node:fs/promises';
import { LIMITS, requireAbsolute } from './shared';

export const write_file = tool({
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
});
