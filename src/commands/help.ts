import type { Command } from './shared';

export const help: Command = {
  name: 'help',
  description: 'List available slash commands.',
  async run() {
    const { registry } = await import('./index');
    const names = Object.keys(registry).sort();
    const width = names.reduce((m, n) => Math.max(m, n.length + 1), 0);
    for (const name of names) {
      const slashed = `/${name}`.padEnd(width + 1);
      console.log(`  ${slashed}  ${registry[name].description}`);
    }
  },
};
