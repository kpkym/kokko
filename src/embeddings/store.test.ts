import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const upsert = mock(async (_records: unknown) => ({}));
const query = mock(async (_opts: unknown) => ({ matches: [] }));
const listIndexes = mock(async () => ({ indexes: [] as Array<{ name: string }> }));
const createIndex = mock(async (_opts: unknown) => ({}));
const indexFn = mock(<T>(_name: string) => ({ upsert, query }) as unknown as T);

mock.module('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    listIndexes = listIndexes;
    createIndex = createIndex;
    index = indexFn;
  },
}));

const { appendStore, indexName } = await import('./store');

describe('store (pinecone)', () => {
  const prevKey = process.env.PINECONE_API_KEY;
  const prevName = process.env.KOKKO_PINECONE_INDEX;

  beforeEach(() => {
    upsert.mockClear();
    query.mockClear();
    listIndexes.mockClear();
    createIndex.mockClear();
    indexFn.mockClear();
    process.env.PINECONE_API_KEY = 'test-key';
    delete process.env.KOKKO_PINECONE_INDEX;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.PINECONE_API_KEY;
    else process.env.PINECONE_API_KEY = prevKey;
    if (prevName === undefined) delete process.env.KOKKO_PINECONE_INDEX;
    else process.env.KOKKO_PINECONE_INDEX = prevName;
  });

  test('indexName defaults and respects override', () => {
    expect(indexName()).toBe('kokko');
    process.env.KOKKO_PINECONE_INDEX = 'custom';
    expect(indexName()).toBe('custom');
  });

  test('appendStore upserts vectors with metadata; creates index if missing', async () => {
    listIndexes.mockResolvedValueOnce({ indexes: [] });
    const r = await appendStore(
      [
        { id: 'a', source: '/x.md', content: 'hello' },
        { id: 'b', source: '/x.md', content: 'world' },
      ],
      [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ],
    );
    expect(r).toEqual({ added: 2, dim: 3 });
    expect(createIndex).toHaveBeenCalledTimes(1);
    expect(createIndex.mock.calls[0]?.[0]).toMatchObject({
      name: 'kokko',
      dimension: 3,
      metric: 'cosine',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toEqual({
      records: [
        { id: 'a', values: [0.1, 0.2, 0.3], metadata: { source: '/x.md', content: 'hello' } },
        { id: 'b', values: [0.4, 0.5, 0.6], metadata: { source: '/x.md', content: 'world' } },
      ],
    });
  });

  test('appendStore skips createIndex when index already exists', async () => {
    listIndexes.mockResolvedValueOnce({ indexes: [{ name: 'kokko' }] });
    await appendStore([{ id: 'a', source: '/x', content: 'hi' }], [[1, 0, 0]]);
    expect(createIndex).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  test('empty append is a no-op (no API calls)', async () => {
    const r = await appendStore([], []);
    expect(r).toEqual({ added: 0, dim: 0 });
    expect(listIndexes).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  test('rejects mismatched lengths', async () => {
    await expect(
      appendStore([{ id: 'a', source: '/x', content: 'hi' }], []),
    ).rejects.toThrow(/length mismatch/);
  });

  test('rejects mismatched dims within batch', async () => {
    await expect(
      appendStore(
        [
          { id: 'a', source: '/x', content: 'hi' },
          { id: 'b', source: '/x', content: 'bye' },
        ],
        [[1, 0, 0], [1, 0]],
      ),
    ).rejects.toThrow(/dim mismatch/);
  });

  test('throws without PINECONE_API_KEY', async () => {
    delete process.env.PINECONE_API_KEY;
    await expect(
      appendStore([{ id: 'a', source: '/x', content: 'hi' }], [[1, 0, 0]]),
    ).rejects.toThrow(/PINECONE_API_KEY/);
  });
});
