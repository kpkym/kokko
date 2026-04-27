import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { SkillMetadata } from './types';
import { parseSkillFrontmatter } from './frontmatter';

export interface DiscoverOptions {
  /** Map a skill folder name to its registered name (e.g., add `<plugin>:` prefix). */
  nameOverride?: (folder: string) => string;
}

async function dirEntries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function discoverInDir(
  dir: string,
  opts: DiscoverOptions = {},
): Promise<SkillMetadata[]> {
  const entries = await dirEntries(dir);
  const out: SkillMetadata[] = [];
  for (const folder of entries) {
    const skillDir = join(dir, folder);
    const skillFile = join(skillDir, 'SKILL.md');
    const file = Bun.file(skillFile);
    if (!(await file.exists())) continue;
    const text = await file.text();
    const fm = parseSkillFrontmatter(text, skillFile);
    const name = opts.nameOverride ? opts.nameOverride(folder) : fm.name;
    out.push({ name, description: fm.description, dir: skillDir });
  }
  return out;
}
