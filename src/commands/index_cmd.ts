import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import pc from 'picocolors';
import type { Command } from './shared';
import {
  chunk,
  embedDocuments,
  appendStore,
  deleteBySource,
  indexName,
  sourceKey,
  type Chunk,
} from '../embeddings';
import { LIMITS } from '../tools/shared';

const DEFAULT_PATTERN = '**/*.{md,markdown,txt,ts,tsx,js,jsx,py,json,yaml,yml,go,rs,toml}';
const SKIP_DIRS = /(^|\/)(\.git|node_modules|\.kokko|dist|build|\.next|target)(\/|$)/;

async function collectFiles(absPath: string): Promise<string[]> {
  const st = await stat(absPath);
  if (st.isFile()) return [absPath];
  if (!st.isDirectory()) throw new Error(`not a file or directory: ${absPath}`);
  const glob = new Bun.Glob(DEFAULT_PATTERN);
  const out: string[] = [];
  for await (const rel of glob.scan({ cwd: absPath, dot: false, onlyFiles: true })) {
    if (SKIP_DIRS.test(rel)) continue;
    out.push(join(absPath, rel));
  }
  return out;
}

function makeId(source: string, content: string): string {
  return `${sourceKey(source)}#${Bun.hash(`${source} ${content}`).toString(36)}`;
}

export const indexCmd: Command = {
  name: 'index',
  description: 'Embed a file or directory into the RAG store. Usage: /index <absolute-path>',
  async run(args) {
    const path = args[0];
    if (!path) throw new Error('usage: /index <absolute-path>');
    if (!path.startsWith('/')) throw new Error(`path must be absolute (got: ${path})`);

    const files = await collectFiles(path);
    if (files.length === 0) {
      console.log(pc.yellow(`no files matched under ${path}`));
      return;
    }

    let skipped = 0;
    let totalEmptyOrUnchanged = 0;
    const perFile: Array<{ file: string; pieces: string[] }> = [];
    for (const file of files) {
      const f = Bun.file(file);
      if (f.size > LIMITS.maxBytes) {
        skipped++;
        continue;
      }
      const text = await f.text();
      perFile.push({ file, pieces: chunk(text) });
    }

    const allChunks: Chunk[] = [];
    for (const { file, pieces } of perFile) {
      if (pieces.length === 0) {
        totalEmptyOrUnchanged++;
        continue;
      }
      for (const piece of pieces) {
        allChunks.push({ id: makeId(file, piece), source: file, content: piece });
      }
    }

    // Embed first so a quota/network failure leaves the store untouched.
    const vectors =
      allChunks.length > 0 ? await embedDocuments(allChunks.map((c) => c.content)) : [];

    // Evict old chunks for every visited file in parallel before upsert (delete-by-prefix
    // would wipe new ids too if it ran after).
    const deletedCounts = await Promise.all(perFile.map(({ file }) => deleteBySource(file)));
    const totalDeleted = deletedCounts.reduce((a, b) => a + b, 0);

    const r =
      allChunks.length > 0 ? await appendStore(allChunks, vectors) : { added: 0, dim: 0 };
    const totalAdded = r.added;
    const dim = r.dim;

    if (totalAdded === 0 && totalDeleted === 0) {
      console.log(
        pc.yellow(`scanned ${files.length} file(s), nothing changed (all empty or oversize)`),
      );
      return;
    }

    const skipNote = skipped > 0 ? `, skipped ${skipped} oversize` : '';
    const emptyNote = totalEmptyOrUnchanged > 0 ? `, ${totalEmptyOrUnchanged} empty` : '';
    console.log(
      pc.green(
        `upserted ${totalAdded} chunks (dim ${dim}), evicted ${totalDeleted} stale → pinecone index "${indexName()}"${skipNote}${emptyNote}`,
      ),
    );
  },
};
