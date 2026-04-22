import { test, expect } from 'bun:test';
import { tools } from './index';
import { ctx } from './test-helpers';

test('grep rejects relative path', async () => {
  await expect(
    tools.grep.execute!({ pattern: 'x', path: './here' }, ctx),
  ).rejects.toThrow(/absolute/i);
});
