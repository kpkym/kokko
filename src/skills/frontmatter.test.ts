import { test, expect } from 'bun:test';
import { parseSkillFrontmatter } from './frontmatter';

const path = '/fake/SKILL.md';

test('parses valid frontmatter and returns name + description', () => {
  const text = `---
name: my-skill
description: does the thing
---

body here
`;
  expect(parseSkillFrontmatter(text, path)).toEqual({
    name: 'my-skill',
    description: 'does the thing',
  });
});

test('throws when opening fence is missing', () => {
  const text = `name: my-skill\ndescription: x\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: missing frontmatter fence/,
  );
});

test('throws when closing fence is missing', () => {
  const text = `---\nname: my-skill\ndescription: x\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: missing closing frontmatter fence/,
  );
});

test('throws when YAML is unparseable', () => {
  const text = `---\nname: [unterminated\n---\nbody\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: invalid YAML/,
  );
});

test('throws when name is missing', () => {
  const text = `---\ndescription: x\n---\nbody\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: missing 'name' field/,
  );
});

test('throws when description is missing', () => {
  const text = `---\nname: my-skill\n---\nbody\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: missing 'description' field/,
  );
});

test('throws when name is not a string', () => {
  const text = `---\nname: 123\ndescription: x\n---\nbody\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: 'name' must be a string/,
  );
});

test('throws when description is not a string', () => {
  const text = `---\nname: my-skill\ndescription: 42\n---\nbody\n`;
  expect(() => parseSkillFrontmatter(text, path)).toThrow(
    /\[skills\] \/fake\/SKILL\.md: 'description' must be a string/,
  );
});

test('tolerates leading whitespace before the opening fence', () => {
  const text = `\n\n---\nname: a\ndescription: b\n---\n`;
  expect(parseSkillFrontmatter(text, path)).toEqual({ name: 'a', description: 'b' });
});

test('tolerates CRLF line endings', () => {
  const text = `---\r\nname: a\r\ndescription: b\r\n---\r\nbody\r\n`;
  expect(parseSkillFrontmatter(text, path)).toEqual({ name: 'a', description: 'b' });
});
