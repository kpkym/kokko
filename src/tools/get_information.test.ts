import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const query = mock(async (_opts: unknown) => ({ matches: [] }));
const listIndexes = mock(async () => ({ indexes: [{ name: 'kokko' }] }));
const createIndex = mock(async (_opts: unknown) => ({}));
const indexFn = mock(<T>(_name: string) => ({ upsert: async () => ({}), query }) as unknown as T);

mock.module('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    listIndexes = listIndexes;
    createIndex = createIndex;
    index = indexFn;
  },
}));

const embedQueryMock = mock(async (_text: string) => [1, 0, 0]);
mock.module('../embeddings/embed', () => ({
  embedQuery: embedQueryMock,
  embedDocuments: async (_xs: string[]) => [],
  DEFAULT_MODEL: 'voyage-3-large',
}));

const { buildTools } = await import('./index');
const { ctx } = await import('./test-helpers');
const tools = buildTools({ skills: [] });

describe('get_information', () => {
  const prevKey = process.env.PINECONE_API_KEY;

  beforeEach(() => {
    query.mockClear();
    embedQueryMock.mockClear();
    process.env.PINECONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.PINECONE_API_KEY;
    else process.env.PINECONE_API_KEY = prevKey;
  });

  test('returns formatted hits when pinecone returns matches', async () => {
    query.mockResolvedValueOnce({
      matches: [
        { id: '1', score: 0.876543, metadata: { source: '/a.md', content: 'aa' } },
      ],
    });
    const out = (await tools.get_information.execute!(
      { question: 'q' },
      ctx,
    )) as { hits: Array<{ source: string; content: string; similarity: number }> };
    expect(out.hits).toEqual([{ source: '/a.md', content: 'aa', similarity: 0.8765 }]);
  });

  test('returns empty hits + note when no matches', async () => {
    query.mockResolvedValueOnce({ matches: [] });
    const out = (await tools.get_information.execute!(
      { question: 'q' },
      ctx,
    )) as { hits: unknown[]; note?: string };
    expect(out.hits).toEqual([]);
    expect(out.note).toMatch(/no relevant/);
  });

  test('throws when PINECONE_API_KEY missing', async () => {
    delete process.env.PINECONE_API_KEY;
    await expect(tools.get_information.execute!({ question: 'q' }, ctx)).rejects.toThrow(
      /PINECONE_API_KEY/,
    );
  });
});
