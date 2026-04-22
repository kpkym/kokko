import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute } from './shared';

export const edit_file = tool({
  description:
    'Edit a UTF-8 text file by exact string replacement. old_string must appear exactly once unless replace_all=true.',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to an existing file.'),
    old_string: z.string().min(1).describe('Exact substring to replace (must be non-empty).'),
    new_string: z.string().describe('Replacement text.'),
    replace_all: z
      .boolean()
      .optional()
      .describe('If true, replace every occurrence; otherwise require a unique match.'),
  }),
  execute: async ({ path, old_string, new_string, replace_all }) => {
    requireAbsolute(path);
    if (old_string.length === 0) {
      throw new Error('edit_file: old_string must be non-empty');
    }
    if (old_string === new_string) {
      throw new Error('edit_file: old_string and new_string are identical');
    }
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`edit_file: file not found (path=${path})`);
    }
    const content = await file.text();
    if (new TextEncoder().encode(content).length > LIMITS.maxWriteBytes) {
      throw new Error(
        `edit_file: file exceeds ${LIMITS.maxWriteBytes} bytes`,
      );
    }

    let count = 0;
    let idx = 0;
    while ((idx = content.indexOf(old_string, idx)) !== -1) {
      count++;
      idx += old_string.length;
    }
    if (count === 0) {
      throw new Error('edit_file: old_string not found');
    }
    if (!replace_all && count > 1) {
      throw new Error(
        `edit_file: old_string appears ${count} times; provide more context or set replace_all=true`,
      );
    }

    const next = content.split(old_string).join(new_string);

    await Bun.write(path, next);
    const replacements = replace_all ? count : 1;
    return `edited ${path} (${replacements} replacement(s))`;
  },
});
