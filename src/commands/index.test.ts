import { test, expect, spyOn } from 'bun:test';
import { runCommand, registry } from './index';
import { makeCtx } from './test-helpers';

test('non-slash input returns "not-a-command" and does not print', async () => {
  const logSpy = spyOn(console, 'log').mockImplementation(() => {});
  try {
    const ctx = makeCtx();
    const outcome = await runCommand('hello there', ctx);
    expect(outcome).toBe('not-a-command');
    expect(logSpy).not.toHaveBeenCalled();
  } finally {
    logSpy.mockRestore();
  }
});

test('empty input returns "not-a-command"', async () => {
  const ctx = makeCtx();
  expect(await runCommand('', ctx)).toBe('not-a-command');
  expect(await runCommand('   ', ctx)).toBe('not-a-command');
});

test('whitespace-wrapped slash command is recognized', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    expect(await runCommand('  /model  ', makeCtx())).toBe('handled');
    expect(logs).toEqual(['model: test-model']);
  } finally {
    logSpy.mockRestore();
  }
});

test('bare "/" prints unknown and returns handled', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    expect(await runCommand('/', makeCtx())).toBe('handled');
    expect(logs).toEqual(['unknown command: / — try /help']);
  } finally {
    logSpy.mockRestore();
  }
});

test('unknown command prints unknown and returns handled', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    expect(await runCommand('/nonexistent', makeCtx())).toBe('handled');
    expect(logs).toEqual(['unknown command: /nonexistent — try /help']);
  } finally {
    logSpy.mockRestore();
  }
});

test('extra args on argless commands are ignored', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    expect(await runCommand('/provider  foo   bar', makeCtx())).toBe('handled');
    expect(logs).toEqual(['provider: openai']);
  } finally {
    logSpy.mockRestore();
  }
});

test('handler errors are caught and printed as [command error]', async () => {
  const logs: string[] = [];
  const logSpy = spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    logs.push(String(msg));
  });
  try {
    const ctx = makeCtx({
      rebuildSystemPrompt: async () => {
        throw new Error('boom');
      },
    });
    expect(await runCommand('/clear', ctx)).toBe('handled');
    expect(logs).toEqual(['[command error] /clear: boom']);
    expect(ctx.messages).toEqual([]);
  } finally {
    logSpy.mockRestore();
  }
});

test('registry includes all implemented commands', () => {
  expect(Object.keys(registry).sort()).toEqual([
    'clear',
    'exit',
    'help',
    'index',
    'model',
    'provider',
  ]);
});
