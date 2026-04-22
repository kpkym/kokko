import { expect, test } from 'bun:test';
import { tools } from './tools';

test('get_current_time returns an ISO 8601 string', async () => {
  const result = await tools.get_current_time.execute!({}, {
    toolCallId: 't1',
    messages: [],
  } as any);
  expect(typeof result).toBe('string');
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(new Date(result as string).toString()).not.toBe('Invalid Date');
});

test('read_file returns file contents as a string', async () => {
  const result = await tools.read_file.execute!(
    { path: './package.json' },
    { toolCallId: 't2', messages: [] } as any,
  );
  expect(typeof result).toBe('string');
  expect(result).toContain('"name": "kokko"');
});

test('read_file propagates filesystem errors', async () => {
  await expect(
    tools.read_file.execute!(
      { path: './does-not-exist-xyz.txt' },
      { toolCallId: 't3', messages: [] } as any,
    ),
  ).rejects.toThrow();
});
