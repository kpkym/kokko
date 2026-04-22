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

export interface EnvInfo {
  cwd: string;
  platform: string;
  shell: string | undefined;
  date: string;
  gitBranch: string | null;
}

const GIT_BRANCH_TIMEOUT_MS = 1000;

async function readGitBranch(cwd: string): Promise<string | null> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
  } catch {
    return null;
  }
  const term = setTimeout(() => proc.kill('SIGTERM'), GIT_BRANCH_TIMEOUT_MS);
  term.unref();
  try {
    const [stdoutBuf, exitCode] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      proc.exited,
    ]);
    if (exitCode !== 0) return null;
    const out = new TextDecoder('utf-8').decode(new Uint8Array(stdoutBuf)).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  } finally {
    clearTimeout(term);
  }
}

export async function collectEnvInfo(cwd: string): Promise<EnvInfo> {
  return {
    cwd,
    platform: process.platform,
    shell: process.env.SHELL,
    date: new Date().toLocaleDateString('sv'), // 'sv' (Swedish) locale formats as YYYY-MM-DD in local TZ
    gitBranch: await readGitBranch(cwd),
  };
}

export function formatSystemPrompt(
  base: string,
  env: EnvInfo,
  docs: ProjectDoc[],
): string {
  const blocks: string[] = [];

  blocks.push(['<base>', base, '</base>'].join('\n'));

  const envLines: string[] = ['<environment>'];
  envLines.push(`cwd: ${env.cwd}`);
  envLines.push(`platform: ${env.platform}`);
  if (env.shell !== undefined) envLines.push(`shell: ${env.shell}`);
  envLines.push(`date: ${env.date}`);
  if (env.gitBranch !== null) envLines.push(`git_branch: ${env.gitBranch}`);
  envLines.push('</environment>');
  blocks.push(envLines.join('\n'));

  if (docs.length > 0) {
    const docLines: string[] = ['<project_docs>'];
    for (const doc of docs) {
      docLines.push(`<file name="${doc.name}">`);
      docLines.push(doc.contents);
      docLines.push('</file>');
    }
    docLines.push('</project_docs>');
    blocks.push(docLines.join('\n'));
  }

  return blocks.join('\n\n');
}

export async function buildSystemPrompt(cwd: string = process.cwd()): Promise<string> {
  const base = loadBasePrompt();
  const env = await collectEnvInfo(cwd);
  const docs = await loadProjectDocs(cwd);
  return formatSystemPrompt(base, env, docs);
}

export function loadBasePrompt(): string {
  const path = process.env.KOKKO_SYSTEM_PROMPT_FILE;
  if (path === undefined || path === '') return BUILT_IN_PROMPT;
  return readFileSync(path, 'utf-8');
}
