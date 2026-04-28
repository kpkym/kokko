import { tool } from 'ai';
import { z } from 'zod';
import { join } from 'node:path';
import type { SkillMetadata } from '../skills/types';

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createLoadSkill(skills: SkillMetadata[]) {
  return tool({
    description:
      'Load the full instructions for a named skill. Use this to fetch the body of a skill listed in the <skills> section of the system prompt before following its instructions. The returned text is wrapped with the skill name and its directory path so you can read bundled files (scripts/, references/, assets/) using read_file/list_dir/bash.',
    inputSchema: z.object({
      name: z.string().describe('The skill name exactly as listed in <skills>.'),
    }),
    execute: async ({ name }) => {
      const meta = skills.find((s) => s.name === name);
      if (!meta) throw new Error(`unknown skill: ${name}`);
      const body = await Bun.file(join(meta.dir, 'SKILL.md')).text();
      return `<skill name="${escapeAttr(meta.name)}" dir="${escapeAttr(meta.dir)}">\n${body}\n</skill>`;
    },
  });
}
