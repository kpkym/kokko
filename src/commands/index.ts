import type { Command, CommandContext } from './shared';
import { clear } from './clear';
import { exit } from './exit';
import { help } from './help';
import { model } from './model';
import { provider } from './provider';

export const registry: Record<string, Command> = Object.fromEntries(
  [clear, exit, help, model, provider].map((c) => [c.name, c]),
);

export async function runCommand(
  raw: string,
  ctx: CommandContext,
): Promise<'handled' | 'not-a-command'> {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) return 'not-a-command';

  const [head, ...args] = trimmed.split(/\s+/);
  const name = head.slice(1);
  if (name === '') {
    console.log('unknown command: / — try /help');
    return 'handled';
  }

  const command = registry[name];
  if (!command) {
    console.log(`unknown command: /${name} — try /help`);
    return 'handled';
  }

  try {
    await command.run(args, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[command error] /${name}: ${msg}`);
  }
  return 'handled';
}

export type { Command, CommandContext } from './shared';
