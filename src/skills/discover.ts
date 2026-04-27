import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import type { SkillMetadata } from './types';
import { parseSkillFrontmatter } from './frontmatter';
import { pickHighestVersion } from './semver';

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

export async function discoverInPluginCache(cacheRoot: string): Promise<SkillMetadata[]> {
  const out: SkillMetadata[] = [];
  const marketplaces = await dirEntries(cacheRoot);
  for (const mp of marketplaces) {
    const mpDir = join(cacheRoot, mp);
    const plugins = await dirEntries(mpDir);
    for (const plugin of plugins) {
      const pluginDir = join(mpDir, plugin);
      const versions = await dirEntries(pluginDir);
      const best = pickHighestVersion(versions);
      if (best === null) continue;
      const skillsDir = join(pluginDir, best, 'skills');
      const found = await discoverInDir(skillsDir, {
        nameOverride: (folder) => `${plugin}:${folder}`,
      });
      out.push(...found);
    }
  }
  return out;
}
