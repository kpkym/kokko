import { tool } from 'ai';
import { z } from 'zod';

export const get_current_time = tool({
  description: 'Get the current time as an ISO 8601 string.',
  inputSchema: z.object({}),
  execute: async () => new Date().toISOString(),
});
