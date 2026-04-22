import { test, expect } from 'bun:test';
import { tools } from './tools';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ctx = { toolCallId: 't', messages: [] } as any;

async function makeTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'kokko-test-'));
}

test('read_file returns file contents as a string', async () => {
  const result = await tools.read_file.execute!(
    { path: `${import.meta.dir}/package.json` },
    ctx,
  );
  expect(typeof result).toBe('string');
  expect(result).toContain('"name": "kokko"');
});

test('read_file propagates filesystem errors', async () => {
  await expect(
    tools.read_file.execute!(
      { path: '/nonexistent/does-not-exist-xyz.txt' },
      ctx,
    ),
  ).rejects.toThrow();
});

test('read_file rejects relative paths', async () => {
  await expect(
    tools.read_file.execute!({ path: './package.json' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('read_file honours 1-based offset and limit', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'lines.txt');
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
    await writeFile(file, lines);

    const result = await tools.read_file.execute!(
      { path: file, offset: 2, limit: 3 },
      ctx,
    );
    expect(result).toContain('line2');
    expect(result).toContain('line3');
    expect(result).toContain('line4');
    expect(result).not.toContain('line1');
    expect(result).not.toContain('line5');
    expect(result).toContain('[truncated: showing lines 2-4 of 10]');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file throws on binary files', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'bin.dat');
    await writeFile(file, new Uint8Array([0x48, 0x00, 0x49]));
    await expect(
      tools.read_file.execute!({ path: file }, ctx),
    ).rejects.toThrow(/binary/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file prepends truncation header when line cap is hit', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'big.txt');
    const content = Array.from({ length: 2500 }, (_, i) => `row${i + 1}`).join('\n');
    await writeFile(file, content);
    const result = await tools.read_file.execute!({ path: file }, ctx) as string;
    expect(result.startsWith('[truncated: showing lines 1-2000 of 2500]\n')).toBe(true);
    expect(result).toContain('row2000');
    expect(result).not.toContain('row2001');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file does not count trailing newline as an extra line', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'trail.txt');
    await writeFile(file, 'a\nb\nc\n');
    const result = await tools.read_file.execute!({ path: file }, ctx) as string;
    expect(result).not.toContain('[truncated');
    expect(result).toBe('a\nb\nc');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file replaces a unique match', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello world\nhello moon');
    const result = await tools.edit_file.execute!(
      { path: file, old_string: 'world', new_string: 'mars' },
      ctx,
    );
    expect(result).toContain('1 replacement');
    expect(await Bun.file(file).text()).toBe('hello mars\nhello moon');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file throws when old_string is absent', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello world');
    await expect(
      tools.edit_file.execute!(
        { path: file, old_string: 'xyz', new_string: 'abc' },
        ctx,
      ),
    ).rejects.toThrow(/not found/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file throws on ambiguous match without replace_all', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello\nhello\nhello');
    await expect(
      tools.edit_file.execute!(
        { path: file, old_string: 'hello', new_string: 'hi' },
        ctx,
      ),
    ).rejects.toThrow(/3 times/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file with replace_all replaces every occurrence', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello\nhello\nhello');
    const result = await tools.edit_file.execute!(
      {
        path: file,
        old_string: 'hello',
        new_string: 'hi',
        replace_all: true,
      },
      ctx,
    );
    expect(result).toContain('3 replacement');
    expect(await Bun.file(file).text()).toBe('hi\nhi\nhi');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file throws when old_string equals new_string', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello');
    await expect(
      tools.edit_file.execute!(
        { path: file, old_string: 'hello', new_string: 'hello' },
        ctx,
      ),
    ).rejects.toThrow(/identical/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file rejects empty old_string', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'hello');
    await expect(
      tools.edit_file.execute!(
        { path: file, old_string: '', new_string: 'x' },
        ctx,
      ),
    ).rejects.toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('edit_file treats new_string $-patterns as literal text', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'edit.txt');
    await writeFile(file, 'foo BAR baz');
    await tools.edit_file.execute!(
      { path: file, old_string: 'BAR', new_string: '$& $1 $$' },
      ctx,
    );
    expect(await Bun.file(file).text()).toBe('foo $& $1 $$ baz');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir lists children with type markers, alphabetically, including dotfiles', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'b.txt'), '');
    await writeFile(join(dir, '.hidden'), '');
    await mkdir(join(dir, 'a-subdir'));
    const result = await tools.list_dir.execute!({ path: dir }, ctx) as string;
    const lines = result.split('\n');
    expect(lines).toEqual(['.hidden', 'a-subdir/', 'b.txt']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir returns (empty) for empty directories', async () => {
  const dir = await makeTempDir();
  try {
    const result = await tools.list_dir.execute!({ path: dir }, ctx);
    expect(result).toBe('(empty)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir throws when path is not a directory', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'file.txt');
    await writeFile(file, '');
    await expect(
      tools.list_dir.execute!({ path: file }, ctx),
    ).rejects.toThrow(/not a directory/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir rejects relative paths', async () => {
  await expect(
    tools.list_dir.execute!({ path: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('glob returns absolute paths matching a pattern', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'a.ts'), '');
    await writeFile(join(dir, 'b.ts'), '');
    await writeFile(join(dir, 'c.md'), '');
    const result = await tools.glob.execute!(
      { pattern: '*.ts', cwd: dir },
      ctx,
    ) as string;
    const lines = result.split('\n');
    expect(lines).toEqual([join(dir, 'a.ts'), join(dir, 'b.ts')]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('glob returns (no matches) when nothing matches', async () => {
  const dir = await makeTempDir();
  try {
    const result = await tools.glob.execute!(
      { pattern: '*.never', cwd: dir },
      ctx,
    );
    expect(result).toBe('(no matches)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('glob rejects relative cwd', async () => {
  await expect(
    tools.glob.execute!({ pattern: '*.ts', cwd: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('bash echoes stdout and reports exit 0', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo hello' },
    ctx,
  )) as string;
  expect(result).toContain('hello');
  expect(result).toContain('[exit code: 0]');
  expect(result).not.toContain('--- stderr ---');
});

test('bash captures stderr separately from stdout', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo out; echo oops 1>&2' },
    ctx,
  )) as string;
  expect(result).toContain('out');
  expect(result).toContain('--- stderr ---');
  expect(result).toContain('oops');
  expect(result).toContain('[exit code: 0]');
});

test('bash reports non-zero exit code without throwing', async () => {
  const result = (await tools.bash.execute!(
    { command: 'exit 3' },
    ctx,
  )) as string;
  expect(result).toContain('[exit code: 3]');
});

test('bash respects cwd', async () => {
  const dir = await makeTempDir();
  try {
    const result = (await tools.bash.execute!(
      { command: 'pwd', cwd: dir },
      ctx,
    )) as string;
    // macOS /tmp is a symlink to /private/tmp; accept either realpath.
    expect(result.includes(dir) || result.includes('/private' + dir)).toBe(true);
    expect(result).toContain('[exit code: 0]');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bash rejects relative cwd', async () => {
  await expect(
    tools.bash.execute!({ command: 'pwd', cwd: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('bash omits the stderr block when stderr is empty', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo only-stdout' },
    ctx,
  )) as string;
  expect(result).not.toContain('--- stderr ---');
});

test('bash rejects timeout_ms over the cap', async () => {
  await expect(
    tools.bash.execute!(
      { command: 'echo x', timeout_ms: 700_000 },
      ctx,
    ),
  ).rejects.toThrow();
});

test('bash times out and marks the process killed', async () => {
  const start = Date.now();
  const result = (await tools.bash.execute!(
    { command: 'sleep 5', timeout_ms: 200 },
    ctx,
  )) as string;
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(2500);
  expect(result).toContain('[timed out after 200ms; process killed]');
  expect(result).toMatch(/\[exit code: -?\d+\]/);
});

test('bash truncates large stdout to the last 30000 bytes', async () => {
  // yes $'a' | head -c 40000 → 40 KB of 'a' characters
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 40000" },
    ctx,
  )) as string;
  expect(result).toMatch(/\[truncated: kept last 30000 of 40000 bytes\]/);
  expect(result).toContain('[exit code: 0]');

  // Tail-kept check: the truncated body should be exactly 30000 'a's.
  const header = '[truncated: kept last 30000 of 40000 bytes]\n';
  const afterHeader = result.slice(result.indexOf(header) + header.length);
  const body = afterHeader.slice(0, 30000);
  expect(body).toBe('a'.repeat(30000));
});

test('bash handles large stdout past the ArrayBuffer threshold', async () => {
  // 500 KB of 'a' — reliably above Bun's Response.bytes() → ArrayBuffer boundary (~200 KB).
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 500000" },
    ctx,
  )) as string;
  expect(result).toContain('[truncated: kept last 30000 of 500000 bytes]');
  expect(result).toContain('[exit code: 0]');
});
