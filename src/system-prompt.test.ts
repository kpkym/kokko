import { test, expect } from 'bun:test';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { loadBasePrompt, loadProjectDocs } from './system-prompt';
import { makeTempDir } from './tools/test-helpers';

test('loadBasePrompt returns built-in default when env unset', () => {
  const prev = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
  try {
    const out = loadBasePrompt();
    expect(out).toContain('You are kokko');
    expect(out).toContain('absolute paths');
  } finally {
    if (prev !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prev;
  }
});

test('loadBasePrompt returns file contents when KOKKO_SYSTEM_PROMPT_FILE is set', async () => {
  const dir = await makeTempDir();
  const path = join(dir, 'prompt.md');
  await writeFile(path, 'CUSTOM PROMPT BODY', 'utf-8');
  const prev = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  process.env.KOKKO_SYSTEM_PROMPT_FILE = path;
  try {
    expect(loadBasePrompt()).toBe('CUSTOM PROMPT BODY');
  } finally {
    if (prev !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prev;
    else delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadBasePrompt throws when KOKKO_SYSTEM_PROMPT_FILE points to nonexistent path', () => {
  const prev = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  process.env.KOKKO_SYSTEM_PROMPT_FILE = '/tmp/kokko-does-not-exist-xyz123.md';
  try {
    expect(() => loadBasePrompt()).toThrow(/ENOENT|no such file/i);
  } finally {
    if (prev !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prev;
    else delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
  }
});

test('loadProjectDocs returns empty list when no docs present', async () => {
  const dir = await makeTempDir();
  try {
    const docs = await loadProjectDocs(dir);
    expect(docs).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadProjectDocs returns just CLAUDE.md when only CLAUDE.md exists', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'CLAUDE.md'), 'C-BODY', 'utf-8');
    const docs = await loadProjectDocs(dir);
    expect(docs).toEqual([{ name: 'CLAUDE.md', contents: 'C-BODY' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadProjectDocs returns just AGENT.md when only AGENT.md exists', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'AGENT.md'), 'A-BODY', 'utf-8');
    const docs = await loadProjectDocs(dir);
    expect(docs).toEqual([{ name: 'AGENT.md', contents: 'A-BODY' }]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
