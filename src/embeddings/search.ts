import { getIndex } from './store';
import { embedQuery } from './embed';

export const DEFAULT_TOP_K = 5;
export const DEFAULT_THRESHOLD = 0.5;

export interface SearchHit {
  source: string;
  content: string;
  similarity: number;
}

export async function search(
  query: string,
  topK = DEFAULT_TOP_K,
  threshold = DEFAULT_THRESHOLD,
): Promise<SearchHit[]> {
  const vec = await embedQuery(query);
  const res = await getIndex().query({
    vector: vec,
    topK,
    includeMetadata: true,
  });
  const hits: SearchHit[] = [];
  for (const m of res.matches ?? []) {
    const score = m.score ?? 0;
    if (score < threshold) continue;
    const md = m.metadata;
    if (!md) continue;
    hits.push({ source: md.source, content: md.content, similarity: score });
  }
  return hits;
}
