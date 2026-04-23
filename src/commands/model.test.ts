import { test, expect, spyOn } from 'bun:test';
import { model } from './model';
import { makeCtx } from './test-helpers';

test('/model prints the current model', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    await model.run([], makeCtx());
  } finally {
    logSpy.mockRestore();
  }
  expect(logs).toEqual(['model: test-model']);
});

test('/model exposes name and description', () => {
  expect(model.name).toBe('model');
  expect(typeof model.description).toBe('string');
  expect(model.description.length).toBeGreaterThan(0);
});
