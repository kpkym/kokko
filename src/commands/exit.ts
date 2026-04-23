import type { Command } from './shared';

export const exit: Command = {
  name: 'exit',
  description: 'Exit the REPL.',
  run(_args, ctx) {
    console.log('bye.');
    ctx.terminal.close();
    process.exit(0);
  },
};
