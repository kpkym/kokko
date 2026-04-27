import type { Store } from './store';
import { loadStore } from './store';
import { embedQuery } from './embed';

export const DEFAULT_TOP_K = 4;
export const DEFAULT_THRESHOLD = 0.5;

export interface SearchHit {
  source: string;
  content: string;
  similarity: number;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array, offsetB = 0): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const dim = a.length;
  for (let i = 0; i < dim; i++) {
    const av = a[i]!;
    const bv = b[offsetB + i]!;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function rank(
  store: Store,
  queryVec: Float32Array,
  topK = DEFAULT_TOP_K,
  threshold = DEFAULT_THRESHOLD,
): SearchHit[] {
  if (queryVec.length !== store.dim) {
    throw new Error(`query dim ${queryVec.length} != store dim ${store.dim}`);
  }
  const scored: SearchHit[] = [];
  for (let i = 0; i < store.chunks.length; i++) {
    const sim = cosineSimilarity(queryVec, store.vectors, i * store.dim);
    if (sim < threshold) continue;
    const c = store.chunks[i]!;
    scored.push({ source: c.source, content: c.content, similarity: sim });
  }
  scored.sort((x, y) => y.similarity - x.similarity);
  return scored.slice(0, topK);
}

export async function search(
  dir: string,
  query: string,
  topK = DEFAULT_TOP_K,
  threshold = DEFAULT_THRESHOLD,
): Promise<SearchHit[]> {
  const store = await loadStore(dir);
  if (!store) return [];
  const vec = await embedQuery(query);
  if (vec.length !== store.dim) {
    throw new Error(
      `query embedding dim ${vec.length} != store dim ${store.dim}. The store was built with a different model.`,
    );
  }
  return rank(store, new Float32Array(vec), topK, threshold);
}
