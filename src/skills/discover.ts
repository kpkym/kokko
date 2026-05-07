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

// Lists subdirectory names in `dir`, skipping regular files (e.g., macOS `.DS_Store`)
// at scan time so callers don't have to defend against ENOTDIR downstream.
async function subdirNames(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return entries
    .filter((e) => e.isDirectory() || e.isSymbolicLink())
    .map((e) => e.name);
}

export async function discoverInDir(
  dir: string,
  opts: DiscoverOptions = {},
): Promise<SkillMetadata[]> {
  const entries = await subdirNames(dir);
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
  const marketplaces = await subdirNames(cacheRoot);
  const perMarketplace = await Promise.all(
    marketplaces.map(async (mp) => {
      const mpDir = join(cacheRoot, mp);
      const plugins = await subdirNames(mpDir);
      const perPlugin = await Promise.all(
        plugins.map(async (plugin) => {
          const pluginDir = join(mpDir, plugin);
          const versions = await subdirNames(pluginDir);
          const best = pickHighestVersion(versions);
          if (best === null) return [] as SkillMetadata[];
          const skillsDir = join(pluginDir, best, 'skills');
          return discoverInDir(skillsDir, {
            nameOverride: (folder) => `${plugin}:${folder}`,
          });
        }),
      );
      return perPlugin.flat();
    }),
  );
  return perMarketplace.flat();
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
    const groups = await Promise.all(paths.map((p) => discoverInDir(p)));
    return dedupeFirstWins(groups.flat());
  }

  // Read HOME at call time (not via homedir(), which Bun caches at process startup)
  // so tests can redirect user-global discovery to a temp dir via withEnv('HOME', ...).
  const home = process.env.HOME ?? homedir();
  const groups = await Promise.all([
    discoverInDir(join(cwd, 'skills')),
    discoverInDir(join(cwd, '.claude', 'skills')),
    discoverInDir(join(home, '.claude', 'skills')),
    discoverInPluginCache(join(home, '.claude', 'plugins', 'cache')),
  ]);
  return dedupeFirstWins(groups.flat());
}
