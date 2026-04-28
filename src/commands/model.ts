import pc from 'picocolors';
import type { Command } from './shared';

export const model: Command = {
  name: 'model',
  description: 'Show the current model.',
  run(_args, ctx) {
    console.log(`${pc.dim('model:')} ${pc.cyan(ctx.config.model)}`);
  },
};
