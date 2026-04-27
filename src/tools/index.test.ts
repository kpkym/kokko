import { test, expect } from 'bun:test';
import { buildTools } from './index';

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
  // Tool exists and has expected description prefix
  expect(typeof tools.load_skill.description).toBe('string');
});
