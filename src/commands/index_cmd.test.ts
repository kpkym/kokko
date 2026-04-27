import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const upsert = mock(async (_records: unknown) => ({}));
const listIndexes = mock(async () => ({ indexes: [{ name: 'kokko' }] }));
const createIndex = mock(async (_opts: unknown) => ({}));
const indexFn = mock(<T>(_name: string) => ({ upsert, query: async () => ({ matches: [] }) }) as unknown as T);

mock.module('@pinecone-database/pinecone', () => ({
  Pinecone: class {
    listIndexes = listIndexes;
    createIndex = createIndex;
    index = indexFn;
  },
}));

const embedDocumentsMock = mock(async (xs: string[]) =>
  xs.map((_, i) => [i, i + 1, i + 2]),
);
mock.module('../embeddings/embed', () => ({
  embedQuery: async (_t: string) => [1, 0, 0],
  embedDocuments: embedDocumentsMock,
  DEFAULT_MODEL: 'voyage-3-large',
}));

const { registry } = await import('./index');
const { makeCtx } = await import('./test-helpers');

const indexCmd = registry.index!;

async function makeWorkdir() {
  return await mkdtemp(join(tmpdir(), 'kokko-index-cmd-'));
}

describe('/index', () => {
  const prevKey = process.env.PINECONE_API_KEY;

  beforeEach(() => {
    upsert.mockClear();
    embedDocumentsMock.mockClear();
    process.env.PINECONE_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.PINECONE_API_KEY;
    else process.env.PINECONE_API_KEY = prevKey;
  });

  test('rejects missing path', async () => {
    await expect(indexCmd.run([], makeCtx())).rejects.toThrow(/usage/);
  });

  test('rejects relative path', async () => {
    await expect(indexCmd.run(['rel/path.md'], makeCtx())).rejects.toThrow(/absolute/);
  });

  test('rejects non-existent path', async () => {
    await expect(indexCmd.run(['/no/such/path/here'], makeCtx())).rejects.toThrow();
  });

  test('reports zero matches for empty directory', async () => {
    const work = await makeWorkdir();
    try {
      const empty = join(work, 'empty');
      await mkdir(empty, { recursive: true });
      await indexCmd.run([empty], makeCtx());
      expect(embedDocumentsMock).not.toHaveBeenCalled();
      expect(upsert).not.toHaveBeenCalled();
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  test('chunks, embeds, and upserts to pinecone', async () => {
    const work = await makeWorkdir();
    try {
      await writeFile(join(work, 'a.md'), 'hello world');
      await indexCmd.run([join(work, 'a.md')], makeCtx());
      expect(embedDocumentsMock).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledTimes(1);
      const arg = upsert.mock.calls[0]?.[0] as {
        records: Array<{
          id: string;
          values: number[];
          metadata: { source: string; content: string };
        }>;
      };
      expect(arg.records.length).toBe(1);
      expect(arg.records[0]!.metadata.content).toBe('hello world');
      expect(arg.records[0]!.metadata.source).toBe(join(work, 'a.md'));
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  test('throws when PINECONE_API_KEY missing', async () => {
    delete process.env.PINECONE_API_KEY;
    const work = await makeWorkdir();
    try {
      await writeFile(join(work, 'a.md'), 'hello');
      await expect(indexCmd.run([join(work, 'a.md')], makeCtx())).rejects.toThrow(
        /PINECONE_API_KEY/,
      );
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
});
