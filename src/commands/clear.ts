import pc from 'picocolors';
import type { Command } from './shared';

export const clear: Command = {
  name: 'clear',
  description: 'Clear conversation history (keeps a freshly rebuilt system prompt).',
  async run(_args, ctx) {
    const fresh = await ctx.rebuildSystemPrompt();
    ctx.messages.length = 0;
    ctx.messages.push({ role: 'system', content: fresh });
    console.log(pc.dim('history cleared.'));
  },
};
