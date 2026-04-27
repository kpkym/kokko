import { test, expect } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverInDir } from './discover';
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
