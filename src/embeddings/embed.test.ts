import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { embedQuery, embedDocuments } from './embed';

describe('embed env validation', () => {
  const prev = process.env.VOYAGE_API_KEY;

  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = prev;
  });

  test('embedQuery throws without VOYAGE_API_KEY', async () => {
    await expect(embedQuery('hi')).rejects.toThrow(/VOYAGE_API_KEY/);
  });

  test('embedDocuments throws without VOYAGE_API_KEY', async () => {
    await expect(embedDocuments(['hi'])).rejects.toThrow(/VOYAGE_API_KEY/);
  });

  test('embedDocuments returns [] for empty input without calling provider', async () => {
    expect(await embedDocuments([])).toEqual([]);
  });
});
