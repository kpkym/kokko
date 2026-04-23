import type { Command } from './shared';

export const provider: Command = {
  name: 'provider',
  description: 'Show the current provider.',
  run(_args, ctx) {
    console.log(`provider: ${ctx.config.provider}`);
  },
};
