import { test, expect, spyOn } from 'bun:test';
import { exit } from './exit';
import { makeCtx } from './test-helpers';

test('/exit prints bye, closes terminal, exits 0, in that order', async () => {
  const events: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    events.push(`log:${String(msg)}`);
  });
  const exitSpy = spyOn(process, 'exit').mockImplementation(((code?: number) => {
    events.push(`exit:${code ?? 0}`);
    return undefined as never;
  }) as typeof process.exit);
  try {
    const ctx = makeCtx({
      terminal: { close: () => events.push('close') } as any,
    });
    await exit.run([], ctx);
  } finally {
    logSpy.mockRestore();
    exitSpy.mockRestore();
  }
  expect(events).toEqual(['log:bye.', 'close', 'exit:0']);
});

test('/exit exposes name and description', () => {
  expect(exit.name).toBe('exit');
  expect(typeof exit.description).toBe('string');
  expect(exit.description.length).toBeGreaterThan(0);
});
