import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const MAGIC = 0x4b4b4245;
const HEADER_BYTES = 8;

export interface Chunk {
  id: string;
  source: string;
  content: string;
}

export interface Store {
  dir: string;
  dim: number;
  chunks: Chunk[];
  vectors: Float32Array;
}

export function defaultRagDir(cwd = process.cwd()): string {
  return process.env.KOKKO_RAG_DIR ?? join(cwd, '.kokko', 'rag');
}

function chunksPath(dir: string) {
  return join(dir, 'chunks.jsonl');
}
function vectorsPath(dir: string) {
  return join(dir, 'embeddings.bin');
}

export async function loadStore(dir: string): Promise<Store | null> {
  const cf = Bun.file(chunksPath(dir));
  const vf = Bun.file(vectorsPath(dir));
  if (!(await cf.exists()) || !(await vf.exists())) return null;

  const text = await cf.text();
  const chunks: Chunk[] = text
    .split('\n')
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as Chunk);

  const buf = new Uint8Array(await vf.arrayBuffer());
  if (buf.byteLength < HEADER_BYTES) {
    throw new Error(`embeddings.bin too small (${buf.byteLength} bytes)`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== MAGIC) throw new Error(`embeddings.bin: bad magic ${magic.toString(16)}`);
  const dim = view.getUint32(4, true);
  if (dim === 0) throw new Error('embeddings.bin: zero dim');

  const expectedBytes = HEADER_BYTES + chunks.length * dim * 4;
  if (buf.byteLength !== expectedBytes) {
    throw new Error(
      `embeddings.bin size mismatch: got ${buf.byteLength}, expected ${expectedBytes} for ${chunks.length} × ${dim}`,
    );
  }
  const vectors = new Float32Array(buf.buffer, buf.byteOffset + HEADER_BYTES, chunks.length * dim);
  return { dir, dim, chunks, vectors: new Float32Array(vectors) };
}

export async function appendStore(
  dir: string,
  newChunks: Chunk[],
  newVectors: number[][],
): Promise<{ added: number; total: number; dim: number }> {
  if (newChunks.length !== newVectors.length) {
    throw new Error(`chunks/vectors length mismatch: ${newChunks.length} vs ${newVectors.length}`);
  }
  if (newChunks.length === 0) {
    const existing = await loadStore(dir);
    return {
      added: 0,
      total: existing?.chunks.length ?? 0,
      dim: existing?.dim ?? 0,
    };
  }
  const firstDim = newVectors[0]!.length;
  if (firstDim === 0) throw new Error('vector with zero dim');
  for (const v of newVectors) {
    if (v.length !== firstDim) {
      throw new Error(`vector dim mismatch: ${v.length} vs ${firstDim}`);
    }
  }

  await mkdir(dir, { recursive: true });
  const existing = await loadStore(dir);
  if (existing && existing.dim !== firstDim) {
    throw new Error(
      `dim mismatch: store has ${existing.dim}, new vectors have ${firstDim}. Delete ${dir} to re-index with a different model.`,
    );
  }

  const oldJsonl = existing ? await Bun.file(chunksPath(dir)).text() : '';
  const newJsonl = newChunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
  await Bun.write(chunksPath(dir), oldJsonl + newJsonl);

  const flatLen = newChunks.length * firstDim;
  const flat = new Float32Array(flatLen);
  for (let i = 0; i < newChunks.length; i++) {
    flat.set(newVectors[i]!, i * firstDim);
  }
  const flatBytes = new Uint8Array(flat.buffer, flat.byteOffset, flat.byteLength);

  if (existing) {
    const oldBuf = new Uint8Array(await Bun.file(vectorsPath(dir)).arrayBuffer());
    const merged = new Uint8Array(oldBuf.byteLength + flatBytes.byteLength);
    merged.set(oldBuf, 0);
    merged.set(flatBytes, oldBuf.byteLength);
    await Bun.write(vectorsPath(dir), merged);
  } else {
    const out = new Uint8Array(HEADER_BYTES + flatBytes.byteLength);
    const view = new DataView(out.buffer);
    view.setUint32(0, MAGIC, true);
    view.setUint32(4, firstDim, true);
    out.set(flatBytes, HEADER_BYTES);
    await Bun.write(vectorsPath(dir), out);
  }

  const totalChunks = (existing?.chunks.length ?? 0) + newChunks.length;
  return { added: newChunks.length, total: totalChunks, dim: firstDim };
}
