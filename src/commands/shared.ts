import type { ModelMessage } from 'ai';
import type * as readline from 'node:readline/promises';
import type { Config } from '../config';

export interface CommandContext {
  messages: ModelMessage[];
  config: Config;
  terminal: readline.Interface;
  rebuildSystemPrompt: () => Promise<string>;
}

export interface Command {
  name: string;
  description: string;
  run(args: string[], ctx: CommandContext): Promise<void> | void;
}
