import { test, expect, spyOn } from 'bun:test';
import type { ModelMessage } from 'ai';
import { clear } from './clear';
import { makeCtx } from './test-helpers';

test('/clear rebuilds prompt then replaces messages with a single system message', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    const ctx = makeCtx({
      messages: [
        { role: 'system', content: 'old-system' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
      rebuildSystemPrompt: async () => 'fresh-system',
    });
    await clear.run([], ctx);
    expect(ctx.messages).toEqual([{ role: 'system', content: 'fresh-system' }]);
    expect(logs).toEqual(['history cleared.']);
  } finally {
    logSpy.mockRestore();
  }
});

test('/clear leaves messages untouched when rebuildSystemPrompt throws', async () => {
  const logSpy = spyOn(console, 'log').mockImplementation(() => {});
  try {
    const original: ModelMessage[] = [
      { role: 'system', content: 'old-system' },
      { role: 'user', content: 'hi' },
    ];
    const ctx = makeCtx({
      messages: [...original],
      rebuildSystemPrompt: async () => {
        throw new Error('boom');
      },
    });
    await expect(clear.run([], ctx)).rejects.toThrow('boom');
    expect(ctx.messages).toEqual(original);
  } finally {
    logSpy.mockRestore();
  }
});

test('/clear exposes name and description', () => {
  expect(clear.name).toBe('clear');
  expect(typeof clear.description).toBe('string');
  expect(clear.description.length).toBeGreaterThan(0);
});
