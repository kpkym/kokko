import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute } from './shared';

export const edit_file = tool({
  description:
    'Edit a UTF-8 text file by sequential exact-string replacements. ' +
    'Pass one or more {old_string, new_string, replace_all?} entries in `edits`; each is applied to the result of the previous one and the file is written once at the end. ' +
    'Each old_string must appear exactly once in its target unless replace_all=true.',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to an existing file.'),
    edits: z
      .array(
        z.object({
          old_string: z
            .string()
            .min(1)
            .describe('Exact substring to replace (must be non-empty).'),
          new_string: z.string().describe('Replacement text.'),
          replace_all: z
            .boolean()
            .optional()
            .describe(
              'If true, replace every occurrence; otherwise require a unique match.',
            ),
        }),
      )
      .min(1)
      .describe('One or more edits applied sequentially. Use a single-element array for a single edit.'),
  }),
  execute: async ({ path, edits }) => {
    requireAbsolute(path);
    if (edits.length === 0) {
      throw new Error('edit_file: edits must contain at least one entry');
    }
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`edit_file: file not found (path=${path})`);
    }
    let content = await file.text();
    if (new TextEncoder().encode(content).length > LIMITS.maxWriteBytes) {
      throw new Error(`edit_file: file exceeds ${LIMITS.maxWriteBytes} bytes`);
    }

    let totalReplacements = 0;
    edits.forEach((e, i) => {
      if (e.old_string.length === 0) {
        throw new Error(`edit_file: edits[${i}].old_string must be non-empty`);
      }
      if (e.old_string === e.new_string) {
        throw new Error(
          `edit_file: edits[${i}].old_string and new_string are identical`,
        );
      }
      let count = 0;
      let idx = 0;
      while ((idx = content.indexOf(e.old_string, idx)) !== -1) {
        count++;
        idx += e.old_string.length;
      }
      if (count === 0) {
        throw new Error(`edit_file: edits[${i}].old_string not found`);
      }
      if (!e.replace_all && count > 1) {
        throw new Error(
          `edit_file: edits[${i}].old_string appears ${count} times; provide more context or set replace_all=true`,
        );
      }
      content = content.split(e.old_string).join(e.new_string);
      totalReplacements += e.replace_all ? count : 1;
    });

    await Bun.write(path, content);
    return `edited ${path} (${edits.length} edit(s), ${totalReplacements} replacement(s))`;
  },
});
