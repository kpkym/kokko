export { chunk, CHUNK_SIZE, CHUNK_OVERLAP } from './chunk';
export { embedQuery, embedDocuments, DEFAULT_MODEL } from './embed';
export { appendStore, loadStore, defaultRagDir } from './store';
export type { Chunk, Store } from './store';
export { search, rank, cosineSimilarity, DEFAULT_TOP_K, DEFAULT_THRESHOLD } from './search';
export type { SearchHit } from './search';
