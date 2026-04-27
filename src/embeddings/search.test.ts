import { describe, expect, test } from 'bun:test';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendStore } from './store';
import { rank, cosineSimilarity, search } from './search';
import type { Store } from './store';

async function makeDir() {
  return await mkdtemp(join(tmpdir(), 'kokko-search-'));
}

describe('cosineSimilarity', () => {
  test('identical vectors → 1', () => {
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  test('orthogonal vectors → 0', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  test('zero vector → 0', () => {
    const a = new Float32Array([1, 2, 3]);
    const z = new Float32Array([0, 0, 0]);
    expect(cosineSimilarity(a, z)).toBe(0);
  });

  test('honors offsetB into a flat store', () => {
    const a = new Float32Array([1, 0, 0]);
    const flat = new Float32Array([0, 1, 0, 1, 0, 0]);
    expect(cosineSimilarity(a, flat, 0)).toBeCloseTo(0, 5);
    expect(cosineSimilarity(a, flat, 3)).toBeCloseTo(1, 5);
  });
});

describe('rank', () => {
  test('orders by similarity and applies topK + threshold', () => {
    const store: Store = {
      dir: '/x',
      dim: 2,
      chunks: [
        { id: '1', source: '/a', content: 'aa' },
        { id: '2', source: '/b', content: 'bb' },
        { id: '3', source: '/c', content: 'cc' },
      ],
      vectors: new Float32Array([1, 0, 0.9, 0.1, 0, 1]),
    };
    const q = new Float32Array([1, 0]);
    const hits = rank(store, q, 2, 0.5);
    expect(hits.map((h) => h.content)).toEqual(['aa', 'bb']);
    expect(hits[0]!.similarity).toBeGreaterThan(hits[1]!.similarity);
  });

  test('throws on dim mismatch', () => {
    const store: Store = { dir: '/x', dim: 3, chunks: [], vectors: new Float32Array(0) };
    expect(() => rank(store, new Float32Array([1, 0]), 4, 0.5)).toThrow(/dim/);
  });
});

describe('search', () => {
  test('returns [] when no store exists', async () => {
    const dir = await makeDir();
    try {
      const prev = process.env.VOYAGE_API_KEY;
      delete process.env.VOYAGE_API_KEY;
      try {
        expect(await search(dir, 'q')).toEqual([]);
      } finally {
        if (prev !== undefined) process.env.VOYAGE_API_KEY = prev;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('throws via embedQuery when store exists but no api key', async () => {
    const dir = await makeDir();
    try {
      await appendStore(dir, [{ id: 'a', source: '/x', content: 'hi' }], [[1, 0, 0]]);
      const prev = process.env.VOYAGE_API_KEY;
      delete process.env.VOYAGE_API_KEY;
      try {
        await expect(search(dir, 'q')).rejects.toThrow(/VOYAGE_API_KEY/);
      } finally {
        if (prev !== undefined) process.env.VOYAGE_API_KEY = prev;
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
