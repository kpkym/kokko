import { test, expect } from 'bun:test';
import { loadBasePrompt } from './system-prompt';

test('loadBasePrompt returns built-in default when env unset', () => {
  const prev = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
  try {
    const out = loadBasePrompt();
    expect(out).toContain('You are kokko');
    expect(out).toContain('absolute paths');
  } finally {
    if (prev !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prev;
  }
});
