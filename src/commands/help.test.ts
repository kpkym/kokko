import { test, expect, spyOn } from 'bun:test';
import { help } from './help';
import { registry } from './index';
import { makeCtx } from './test-helpers';

test('/help lists every registered command with its description', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    await help.run([], makeCtx());
  } finally {
    logSpy.mockRestore();
  }
  const joined = logs.join('\n');
  for (const name of Object.keys(registry)) {
    expect(joined).toContain(`/${name}`);
    expect(joined).toContain(registry[name].description);
  }
});

test('/help output is sorted alphabetically by command name', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    await help.run([], makeCtx());
  } finally {
    logSpy.mockRestore();
  }
  const names = logs
    .map((line) => line.match(/^\s*\/(\w+)/)?.[1])
    .filter((n): n is string => !!n);
  const sorted = [...names].sort();
  expect(names).toEqual(sorted);
});

test('/help exposes name and description', () => {
  expect(help.name).toBe('help');
  expect(typeof help.description).toBe('string');
  expect(help.description.length).toBeGreaterThan(0);
});
