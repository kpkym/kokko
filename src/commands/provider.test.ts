import { test, expect, spyOn } from 'bun:test';
import { provider } from './provider';
import { makeCtx } from './test-helpers';

test('/provider prints the current provider', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    await provider.run([], makeCtx());
  } finally {
    logSpy.mockRestore();
  }
  expect(logs).toEqual(['provider: openai']);
});

test('/provider exposes name and description', () => {
  expect(provider.name).toBe('provider');
  expect(typeof provider.description).toBe('string');
  expect(provider.description.length).toBeGreaterThan(0);
});
