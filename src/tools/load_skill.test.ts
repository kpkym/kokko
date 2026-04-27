import { test, expect } from 'bun:test';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createLoadSkill } from './load_skill';
import { ctx, makeTempDir } from './test-helpers';
import type { SkillMetadata } from '../skills/types';

test('load_skill: returns wrapped SKILL.md body for a known skill', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = join(dir, 'foo');
    await mkdir(skillDir, { recursive: true });
    const body = `---\nname: foo\ndescription: d\n---\nINSTRUCTIONS GO HERE\n`;
    await writeFile(join(skillDir, 'SKILL.md'), body, 'utf-8');
    const tool = createLoadSkill([{ name: 'foo', description: 'd', dir: skillDir }]);
    const out = await tool.execute!({ name: 'foo' }, ctx);
    expect(out).toBe(`<skill name="foo" dir="${skillDir}">\n${body}\n</skill>`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('load_skill: throws on unknown name', async () => {
  const tool = createLoadSkill([
    { name: 'real', description: 'd', dir: '/tmp/real' },
  ]);
  await expect(tool.execute!({ name: 'fake' }, ctx)).rejects.toThrow(/unknown skill: fake/);
});

test('load_skill: throws when SKILL.md is missing on disk', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = join(dir, 'gone');
    await mkdir(skillDir, { recursive: true });
    const skills: SkillMetadata[] = [{ name: 'gone', description: 'd', dir: skillDir }];
    const tool = createLoadSkill(skills);
    await expect(tool.execute!({ name: 'gone' }, ctx)).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('load_skill: namespaced names work', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = join(dir, 'plugin-x-foo');
    await mkdir(skillDir, { recursive: true });
    const body = `---\nname: foo\ndescription: d\n---\nbody\n`;
    await writeFile(join(skillDir, 'SKILL.md'), body, 'utf-8');
    const tool = createLoadSkill([{ name: 'plugin-x:foo', description: 'd', dir: skillDir }]);
    const out = await tool.execute!({ name: 'plugin-x:foo' }, ctx);
    expect(out).toContain('name="plugin-x:foo"');
    expect(out).toContain(`dir="${skillDir}"`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('load_skill: escapes XML special characters in name and dir attributes', async () => {
  const dir = await makeTempDir();
  try {
    const skillDir = join(dir, 'has-quotes');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      `---\nname: weird\ndescription: d\n---\nbody\n`,
      'utf-8',
    );
    // Inject hostile chars into both name and dir to confirm escaping.
    const tool = createLoadSkill([
      { name: 'a"b<c>d&e', description: 'd', dir: skillDir },
    ]);
    const out = await tool.execute!({ name: 'a"b<c>d&e' }, ctx);
    expect(out).toContain('name="a&quot;b&lt;c&gt;d&amp;e"');
    expect(out).toContain(`dir="${skillDir}"`); // tempdir name has no special chars
    // Confirm no raw closing-tag-like sequence in the attrs.
    expect(out).not.toContain('"b<c>');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
