export { chunk, CHUNK_SIZE, CHUNK_OVERLAP } from './chunk';
export { embedQuery, embedDocuments, DEFAULT_MODEL } from './embed';
export { appendStore, deleteBySource, ensureIndex, getIndex, indexName, sourceKey } from './store';
export type { Chunk, ChunkMetadata } from './store';
export { search, DEFAULT_TOP_K, DEFAULT_THRESHOLD } from './search';
export type { SearchHit } from './search';
