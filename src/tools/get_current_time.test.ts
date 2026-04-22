import { test, expect } from 'bun:test';
import { tools } from './index';

const ctx = { toolCallId: 't', messages: [] } as any;

test('get_current_time returns an ISO 8601 string', async () => {
  const result = await tools.get_current_time.execute!({}, ctx);
  expect(typeof result).toBe('string');
  expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(new Date(result as string).toString()).not.toBe('Invalid Date');
});
