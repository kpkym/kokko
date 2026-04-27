import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
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
    let text: string;
    try {
      text = await Bun.file(skillFile).text();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }
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

function dedupeFirstWins(metas: SkillMetadata[]): SkillMetadata[] {
  const seen = new Set<string>();
  const out: SkillMetadata[] = [];
  for (const m of metas) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    out.push(m);
  }
  return out;
}

export async function discoverSkills(cwd: string): Promise<SkillMetadata[]> {
  const envOverride = process.env.KOKKO_SKILLS_DIR;
  if (envOverride !== undefined && envOverride !== '') {
    const paths = envOverride.split(':').filter((p) => p.length > 0);
    const all: SkillMetadata[] = [];
    for (const p of paths) {
      all.push(...(await discoverInDir(p)));
    }
    return dedupeFirstWins(all);
  }

  // Read HOME at call time (not via homedir(), which Bun caches at process startup)
  // so tests can redirect user-global discovery to a temp dir via withEnv('HOME', ...).
  const home = process.env.HOME ?? homedir();
  const all: SkillMetadata[] = [];
  all.push(...(await discoverInDir(join(cwd, 'skills'))));
  all.push(...(await discoverInDir(join(cwd, '.claude', 'skills'))));
  all.push(...(await discoverInDir(join(home, '.claude', 'skills'))));
  all.push(...(await discoverInPluginCache(join(home, '.claude', 'plugins', 'cache'))));
  return dedupeFirstWins(all);
}
