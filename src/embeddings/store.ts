import { Pinecone, type Index } from '@pinecone-database/pinecone';

export interface Chunk {
  id: string;
  source: string;
  content: string;
}

export type ChunkMetadata = { source: string; content: string };

const DEFAULT_INDEX = 'kokko';
const DEFAULT_CLOUD = 'aws';
const DEFAULT_REGION = 'us-east-1';

function getClient(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) throw new Error('Missing required env var: PINECONE_API_KEY');
  return new Pinecone({ apiKey });
}

export function indexName(): string {
  return process.env.KOKKO_PINECONE_INDEX ?? DEFAULT_INDEX;
}

export function getIndex(): Index<ChunkMetadata> {
  return getClient().index<ChunkMetadata>(indexName());
}

export async function ensureIndex(dim: number): Promise<void> {
  const pc = getClient();
  const name = indexName();
  const list = await pc.listIndexes();
  const exists = (list.indexes ?? []).some((ix) => ix.name === name);
  if (exists) return;
  await pc.createIndex({
    name,
    dimension: dim,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: (process.env.PINECONE_CLOUD ?? DEFAULT_CLOUD) as 'aws' | 'gcp' | 'azure',
        region: process.env.PINECONE_REGION ?? DEFAULT_REGION,
      },
    },
    waitUntilReady: true,
  });
}

export async function appendStore(
  chunks: Chunk[],
  vectors: number[][],
): Promise<{ added: number; dim: number }> {
  if (chunks.length !== vectors.length) {
    throw new Error(`chunks/vectors length mismatch: ${chunks.length} vs ${vectors.length}`);
  }
  if (chunks.length === 0) return { added: 0, dim: 0 };

  const dim = vectors[0]!.length;
  if (dim === 0) throw new Error('vector with zero dim');
  for (const v of vectors) {
    if (v.length !== dim) throw new Error(`vector dim mismatch: ${v.length} vs ${dim}`);
  }

  await ensureIndex(dim);
  const index = getIndex();
  await index.upsert({
    records: chunks.map((c, i) => ({
      id: c.id,
      values: vectors[i]!,
      metadata: { source: c.source, content: c.content },
    })),
  });
  return { added: chunks.length, dim };
}
