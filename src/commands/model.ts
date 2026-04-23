import type { Command } from './shared';

export const model: Command = {
  name: 'model',
  description: 'Show the current model.',
  run(_args, ctx) {
    console.log(`model: ${ctx.config.model}`);
  },
};
