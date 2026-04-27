import { test, expect } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverInDir, discoverInPluginCache } from './discover';
import { makeTempDir } from '../tools/test-helpers';

async function writeSkill(dir: string, folder: string, name: string, description: string): Promise<string> {
  const skillDir = join(dir, folder);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\nbody\n`,
    'utf-8',
  );
  return skillDir;
}

test('discoverInDir: returns empty array when directory does not exist', async () => {
  const out = await discoverInDir('/does/not/exist/xyz123');
  expect(out).toEqual([]);
});

test('discoverInDir: returns empty array when directory is empty', async () => {
  const dir = await makeTempDir();
  try {
    expect(await discoverInDir(dir)).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInDir: discovers a single SKILL.md', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = await writeSkill(dir, 'my-skill', 'my-skill', 'does the thing');
    const out = await discoverInDir(dir);
    expect(out).toEqual([{ name: 'my-skill', description: 'does the thing', dir: skillDir }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInDir: discovers multiple SKILL.md folders', async () => {
  const dir = await makeTempDir();
  try {
    await writeSkill(dir, 'a', 'a', 'desc-a');
    await writeSkill(dir, 'b', 'b', 'desc-b');
    const out = await discoverInDir(dir);
    expect(out.map((s) => s.name).sort()).toEqual(['a', 'b']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInDir: ignores subfolders without SKILL.md', async () => {
  const dir = await makeTempDir();
  try {
    await mkdir(join(dir, 'no-skill'), { recursive: true });
    await writeSkill(dir, 'has-skill', 'has-skill', 'desc');
    const out = await discoverInDir(dir);
    expect(out.map((s) => s.name)).toEqual(['has-skill']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInDir: throws when a SKILL.md is malformed', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = join(dir, 'bad');
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), 'no frontmatter here\n', 'utf-8');
    await expect(discoverInDir(dir)).rejects.toThrow(/missing frontmatter fence/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInDir: applies optional name override', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = await writeSkill(dir, 'foo', 'foo', 'desc');
    const out = await discoverInDir(dir, { nameOverride: (folder) => `plugin:${folder}` });
    expect(out).toEqual([{ name: 'plugin:foo', description: 'desc', dir: skillDir }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('discoverInPluginCache: returns empty when cacheRoot does not exist', async () => {
  expect(await discoverInPluginCache('/does/not/exist/xyz123')).toEqual([]);
});

test('discoverInPluginCache: discovers skill with <plugin>:<skill> namespace', async () => {
  const cache = await makeTempDir();
  try {
    const skillDir = join(cache, 'mp', 'superpowers', '5.0.7', 'skills', 'brainstorming');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---\nname: brainstorming\ndescription: explore ideas\n---\nbody\n`,
      'utf-8',
    );
    const out = await discoverInPluginCache(cache);
    expect(out).toEqual([
      { name: 'superpowers:brainstorming', description: 'explore ideas', dir: skillDir },
    ]);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});

test('discoverInPluginCache: picks highest semver version for a plugin', async () => {
  const cache = await makeTempDir();
  try {
    const oldDir = join(cache, 'mp', 'superpowers', '5.0.7', 'skills', 'brainstorming');
    const newDir = join(cache, 'mp', 'superpowers', '5.1.0', 'skills', 'brainstorming');
    await mkdir(oldDir, { recursive: true });
    await mkdir(newDir, { recursive: true });
    await writeFile(
      join(oldDir, 'SKILL.md'),
      `---\nname: brainstorming\ndescription: OLD\n---\n`,
      'utf-8',
    );
    await writeFile(
      join(newDir, 'SKILL.md'),
      `---\nname: brainstorming\ndescription: NEW\n---\n`,
      'utf-8',
    );
    const out = await discoverInPluginCache(cache);
    expect(out).toEqual([
      { name: 'superpowers:brainstorming', description: 'NEW', dir: newDir },
    ]);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});

test('discoverInPluginCache: discovers across multiple plugins and marketplaces', async () => {
  const cache = await makeTempDir();
  try {
    const a = join(cache, 'mp1', 'plugin-a', '1.0.0', 'skills', 'foo');
    const b = join(cache, 'mp2', 'plugin-b', '2.0.0', 'skills', 'bar');
    await mkdir(a, { recursive: true });
    await mkdir(b, { recursive: true });
    await writeFile(join(a, 'SKILL.md'), `---\nname: foo\ndescription: A\n---\n`, 'utf-8');
    await writeFile(join(b, 'SKILL.md'), `---\nname: bar\ndescription: B\n---\n`, 'utf-8');
    const out = await discoverInPluginCache(cache);
    expect(out.map((s) => s.name).sort()).toEqual(['plugin-a:foo', 'plugin-b:bar']);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});

test('discoverInPluginCache: skips plugin with no semver version dir', async () => {
  const cache = await makeTempDir();
  try {
    await mkdir(join(cache, 'mp', 'broken-plugin', 'README.md'), { recursive: true });
    expect(await discoverInPluginCache(cache)).toEqual([]);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});

test('discoverInPluginCache: tolerates plugin with no skills/ dir', async () => {
  const cache = await makeTempDir();
  try {
    await mkdir(join(cache, 'mp', 'plug', '1.0.0'), { recursive: true });
    expect(await discoverInPluginCache(cache)).toEqual([]);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});
