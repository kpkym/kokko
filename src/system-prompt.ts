import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const BUILT_IN_PROMPT = `You are kokko, a terminal-based coding agent. You help the user with software engineering tasks in their current working directory by reading/editing files and running shell commands through the tools provided.

Tool usage principles:
- Prefer dedicated tools over \`bash\` when one fits (\`read_file\`, \`edit_file\`, \`write_file\`, \`glob\`, \`grep\`, \`list_dir\`).
- All filesystem and shell tools require absolute paths — relative paths will be rejected.
- Read before you edit: never call \`edit_file\` or \`write_file\` on a path you haven't inspected this turn (unless creating a new file).
- Make independent tool calls in parallel when there are no dependencies between them.
- If a tool fails, read the error and adjust — don't retry the identical call.

Output style:
- Be concise. Match response length to task complexity; a one-line answer is fine for a one-line question.
- Reference code as \`path:line\` so the user can jump to it.
- Don't narrate what you're about to do at length — just do it and report results.`;

export interface ProjectDoc {
  name: string;
  contents: string;
}

const PROJECT_DOC_FILES = ['CLAUDE.md', 'AGENT.md'] as const;

export async function loadProjectDocs(cwd: string): Promise<ProjectDoc[]> {
  const docs: ProjectDoc[] = [];
  for (const name of PROJECT_DOC_FILES) {
    const file = Bun.file(join(cwd, name));
    if (!(await file.exists())) continue;
    docs.push({ name, contents: await file.text() });
  }
  return docs;
}

export function loadBasePrompt(): string {
  const path = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  if (path === undefined || path === '') return BUILT_IN_PROMPT;
  return readFileSync(path, 'utf-8');
}
