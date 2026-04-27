import { test, expect } from 'bun:test';
import { buildTools } from './index';
import { ctx } from './test-helpers';

test('buildTools: returns all static tools plus load_skill', () => {
  const tools = buildTools({ skills: [] });
  expect(Object.keys(tools).sort()).toEqual(
    [
      'bash',
      'edit_file',
      'get_current_time',
      'glob',
      'grep',
      'list_dir',
      'load_skill',
      'read_file',
      'write_file',
    ].sort(),
  );
});

test('buildTools: load_skill registry reflects passed-in skills', async () => {
  const tools = buildTools({
    skills: [{ name: 'a', description: 'd', dir: '/tmp/a' }],
  });
  // Unknown name throws "unknown skill" — proves byName.get('zzz') was undefined.
  await expect(tools.load_skill.execute!({ name: 'zzz' }, ctx)).rejects.toThrow(/unknown skill: zzz/);
  // Known name passes the registry check (then fails because /tmp/a/SKILL.md doesn't exist).
  // The error is NOT "unknown skill" — proves the injected skill was registered.
  await expect(tools.load_skill.execute!({ name: 'a' }, ctx)).rejects.toThrow();
  await expect(tools.load_skill.execute!({ name: 'a' }, ctx)).rejects.not.toThrow(/unknown skill/);
});
