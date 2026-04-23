import type * as readline from 'node:readline/promises';
import type { Config } from '../config';
import type { CommandContext } from './shared';

export const testConfig: Config = {
  provider: 'openai',
  model: 'test-model',
  baseURL: 'http://x',
  maxSteps: 10,
};

export function makeCtx(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    messages: [],
    config: testConfig,
    terminal: { close: () => {} } as unknown as readline.Interface,
    rebuildSystemPrompt: async () => '<test system prompt>',
    ...overrides,
  };
}
