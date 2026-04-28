import pc from 'picocolors';
import type { Command } from './shared';

export const provider: Command = {
  name: 'provider',
  description: 'Show the current provider.',
  run(_args, ctx) {
    console.log(`${pc.dim('provider:')} ${pc.cyan(ctx.config.provider)}`);
  },
};
