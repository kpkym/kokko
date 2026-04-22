import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
  get_current_time: tool({
    description: 'Get the current time as an ISO 8601 string.',
    inputSchema: z.object({}),
    execute: async () => new Date().toISOString(),
  }),
  read_file: tool({
    description: 'Read a text file from the local filesystem.',
    inputSchema: z.object({
      path: z.string().describe('Absolute or relative path to the file.'),
    }),
    execute: async ({ path }) => await Bun.file(path).text(),
  }),
};
