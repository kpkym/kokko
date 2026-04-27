import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const upsert = mock(async (_records: unknown) => ({}));
const query = mock(async (_opts: unknown) => ({ matches: [] }));
const listIndexes = mock(async () => ({ indexes: [{ name: 'kokko' }] }));
const createIndex = mock(async (_opts: unknown) => ({}));
const indexFn = mock(<T>(_name: string) => ({ upsert, query }) as unknown as T);

mock.module('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    listIndexes = listIndexes;
    createIndex = createIndex;
    index = indexFn;
  },
}));

const embedQueryMock = mock(async (_text: string) => [1, 0, 0]);
mock.module('./embed', () => ({
  embedQuery: embedQueryMock,
  embedDocuments: async (_xs: string[]) => [],
  DEFAULT_MODEL: 'voyage-3-large',
}));

const { search } = await import('./search');

describe('search (pinecone)', () => {
  const prevKey = process.env.PINECONE_API_KEY;

  beforeEach(() => {
    upsert.mockClear();
    query.mockClear();
    embedQueryMock.mockClear();
    process.env.PINECONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.PINECONE_API_KEY;
    else process.env.PINECONE_API_KEY = prevKey;
  });

  test('embeds query then queries pinecone with topK and includeMetadata', async () => {
    query.mockResolvedValueOnce({
      matches: [
        { id: '1', score: 0.92, metadata: { source: '/a.md', content: 'aa' } },
        { id: '2', score: 0.71, metadata: { source: '/b.md', content: 'bb' } },
      ],
    });
    const hits = await search('what?', 4, 0.5);
    expect(embedQueryMock).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toMatchObject({
      vector: [1, 0, 0],
      topK: 4,
      includeMetadata: true,
    });
    expect(hits).toEqual([
      { source: '/a.md', content: 'aa', similarity: 0.92 },
      { source: '/b.md', content: 'bb', similarity: 0.71 },
    ]);
  });

  test('filters out matches below threshold', async () => {
    query.mockResolvedValueOnce({
      matches: [
        { id: '1', score: 0.8, metadata: { source: '/a', content: 'aa' } },
        { id: '2', score: 0.4, metadata: { source: '/b', content: 'bb' } },
        { id: '3', score: 0.3, metadata: { source: '/c', content: 'cc' } },
      ],
    });
    const hits = await search('q', 5, 0.5);
    expect(hits.map((h) => h.content)).toEqual(['aa']);
  });

  test('skips matches with missing metadata', async () => {
    query.mockResolvedValueOnce({
      matches: [
        { id: '1', score: 0.9 },
        { id: '2', score: 0.8, metadata: { source: '/b', content: 'bb' } },
      ],
    });
    const hits = await search('q', 4, 0.5);
    expect(hits).toEqual([{ source: '/b', content: 'bb', similarity: 0.8 }]);
  });

  test('returns [] when pinecone returns no matches', async () => {
    query.mockResolvedValueOnce({ matches: [] });
    expect(await search('q')).toEqual([]);
  });

  test('throws when PINECONE_API_KEY missing', async () => {
    delete process.env.PINECONE_API_KEY;
    await expect(search('q')).rejects.toThrow(/PINECONE_API_KEY/);
  });
});
