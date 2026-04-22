import { test, expect } from 'bun:test';
import { tools } from './index';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ctx, makeTempDir } from './test-helpers';

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
