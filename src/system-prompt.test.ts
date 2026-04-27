import { test, expect } from 'bun:test';
import { writeFile, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { loadBasePrompt, loadProjectDocs, formatSystemPrompt, collectEnvInfo, buildSystemPrompt, type EnvInfo } from './system-prompt';
import type { SkillMetadata } from './skills/types';
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

test('loadProjectDocs returns both files in fixed CLAUDE.md → AGENT.md order', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'AGENT.md'), 'A-BODY', 'utf-8');
    await writeFile(join(dir, 'CLAUDE.md'), 'C-BODY', 'utf-8');
    const docs = await loadProjectDocs(dir);
    expect(docs).toEqual([
      { name: 'CLAUDE.md', contents: 'C-BODY' },
      { name: 'AGENT.md', contents: 'A-BODY' },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loadProjectDocs throws when CLAUDE.md is present but unreadable', async () => {
  const dir = await makeTempDir();
  const path = join(dir, 'CLAUDE.md');
  await writeFile(path, 'secret', 'utf-8');
  await chmod(path, 0o000);
  try {
    await expect(loadProjectDocs(dir)).rejects.toThrow();
  } finally {
    await chmod(path, 0o644);
    await rm(dir, { recursive: true, force: true });
  }
});

test('formatSystemPrompt omits <project_docs> block when docs is empty', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const out = formatSystemPrompt('BASE', env, [], []);
  expect(out).not.toContain('<project_docs>');
  expect(out).toContain('<environment>');
  expect(out.endsWith('</environment>')).toBe(true);
});

test('formatSystemPrompt omits git_branch line when null', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: null,
  };
  const out = formatSystemPrompt('BASE', env, [], []);
  expect(out).not.toContain('git_branch');
  expect(out).toContain('<environment>');
});

test('formatSystemPrompt omits shell line when undefined', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: undefined,
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const out = formatSystemPrompt('BASE', env, [], []);
  expect(out).not.toContain('shell:');
});

test('collectEnvInfo returns shape with cwd, platform, date, shell', async () => {
  const env = await collectEnvInfo('/some/cwd');
  expect(env.cwd).toBe('/some/cwd');
  expect(env.platform).toBe(process.platform);
  expect(env.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  if (process.env.SHELL !== undefined) {
    expect(env.shell).toBe(process.env.SHELL);
  } else {
    expect(env.shell).toBeUndefined();
  }
});

test('collectEnvInfo gitBranch is a string when cwd is a git repo', async () => {
  const env = await collectEnvInfo(import.meta.dir);
  expect(typeof env.gitBranch).toBe('string');
  expect(env.gitBranch!.length).toBeGreaterThan(0);
});

test('collectEnvInfo gitBranch is null when cwd is not a git repo', async () => {
  const dir = await makeTempDir();
  try {
    const env = await collectEnvInfo(dir);
    expect(env.gitBranch).toBeNull();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('collectEnvInfo shell is undefined when SHELL env var is unset', async () => {
  const prev = process.env.SHELL;
  delete process.env.SHELL;
  try {
    const env = await collectEnvInfo('/some/cwd');
    expect(env.shell).toBeUndefined();
  } finally {
    if (prev !== undefined) process.env.SHELL = prev;
  }
});

test('buildSystemPrompt composes base + env + docs end-to-end', async () => {
  const dir = await makeTempDir();
  await writeFile(join(dir, 'CLAUDE.md'), 'PROJECT-RULES', 'utf-8');
  const prevPrompt = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
  try {
    const out = await buildSystemPrompt(dir);
    expect(out).toContain('<base>');
    expect(out).toContain('You are kokko');
    expect(out).toContain('<environment>');
    expect(out).toContain(`cwd: ${dir}`);
    expect(out).toContain(`platform: ${process.platform}`);
    expect(out).not.toContain('git_branch');
    expect(out).toContain('<project_docs>');
    expect(out).toContain('<file name="CLAUDE.md">');
    expect(out).toContain('PROJECT-RULES');
  } finally {
    if (prevPrompt !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prevPrompt;
    await rm(dir, { recursive: true, force: true });
  }
});

test('buildSystemPrompt defaults cwd to process.cwd()', async () => {
  const prevPrompt = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  delete process.env.KOKKO_SYSTEM_PROMPT_FILE;
  try {
    const out = await buildSystemPrompt();
    expect(out).toContain(`cwd: ${process.cwd()}`);
  } finally {
    if (prevPrompt !== undefined) process.env.KOKKO_SYSTEM_PROMPT_FILE = prevPrompt;
  }
});

test('formatSystemPrompt assembles base + environment + project_docs in order', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const out = formatSystemPrompt(
    'BASE',
    env,
    [
      { name: 'CLAUDE.md', contents: 'C-BODY' },
      { name: 'AGENT.md', contents: 'A-BODY' },
    ],
    [],
  );

  expect(out).toBe(
    [
      '<base>',
      'BASE',
      '</base>',
      '',
      '<environment>',
      'cwd: /proj',
      'platform: darwin',
      'shell: /bin/zsh',
      'date: 2026-04-23',
      'git_branch: main',
      '</environment>',
      '',
      '<project_docs>',
      '<file name="CLAUDE.md">',
      'C-BODY',
      '</file>',
      '<file name="AGENT.md">',
      'A-BODY',
      '</file>',
      '</project_docs>',
    ].join('\n'),
  );
});

test('formatSystemPrompt omits <skills> block when skills is empty', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const out = formatSystemPrompt('BASE', env, [], []);
  expect(out).not.toContain('<skills>');
});

test('formatSystemPrompt includes <skills> block between environment and project_docs', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const skills: SkillMetadata[] = [
    { name: 'a', description: 'first', dir: '/tmp/a' },
    { name: 'plugin:b', description: 'second', dir: '/tmp/b' },
  ];
  const out = formatSystemPrompt('BASE', env, [{ name: 'CLAUDE.md', contents: 'X' }], skills);

  expect(out).toContain('<skills>');
  expect(out).toContain('Use load_skill(name)');
  expect(out).toContain('- a: first');
  expect(out).toContain('- plugin:b: second');
  expect(out.indexOf('<skills>')).toBeGreaterThan(out.indexOf('<environment>'));
  expect(out.indexOf('<skills>')).toBeLessThan(out.indexOf('<project_docs>'));
});

test('formatSystemPrompt with skills but no docs places skills after environment', () => {
  const env: EnvInfo = {
    cwd: '/proj',
    platform: 'darwin',
    shell: '/bin/zsh',
    date: '2026-04-23',
    gitBranch: 'main',
  };
  const out = formatSystemPrompt(
    'BASE',
    env,
    [],
    [{ name: 'a', description: 'd', dir: '/tmp/a' }],
  );
  expect(out).toContain('<skills>');
  expect(out).not.toContain('<project_docs>');
  expect(out.indexOf('<skills>')).toBeGreaterThan(out.indexOf('<environment>'));
});
