import { streamText, stepCountIs, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import pc from 'picocolors';
import { config, resolveModel } from './config';
import { buildSystemPrompt } from './system-prompt';
import { buildTools } from './tools';
import { runCommand } from './commands';
import { discoverSkills } from './skills/discover';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

emitKeypressEvents(process.stdin);

const messages: ModelMessage[] = [];

process.on('SIGINT', () => {
  process.stdout.write('\n');
  process.exit(0);
});

function truncate(s: string, max = 80): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function formatArgs(input: unknown): string {
  try {
    return truncate(JSON.stringify(input ?? {}));
  } catch {
    return '<unserializable>';
  }
}

function formatResultSummary(output: unknown): string {
  if (output === undefined) return 'ok (no output)';
  const s = typeof output === 'string' ? output : JSON.stringify(output);
  return `ok (${s.length} chars)`;
}

function formatErrorSummary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `ERROR: ${truncate(msg, 200)}`;
}

async function main() {
  const model = resolveModel();
  const skills = await discoverSkills(process.cwd());
  const tools = buildTools({ skills });
  const systemPrompt = await buildSystemPrompt(process.cwd(), skills);
  messages.push({ role: 'system', content: systemPrompt });
  console.log(
    pc.dim(
      `kokko CLI [${config.provider}:${config.model}] — type a message, Esc to abort, Ctrl+C to exit.\n`,
    ),
  );

  const rebuildSystemPrompt = async () => {
    const fresh = await discoverSkills(process.cwd());
    skills.length = 0;
    skills.push(...fresh);
    return await buildSystemPrompt(process.cwd(), skills);
  };

  while (true) {
    const userInput = await terminal.question('You: ');
    const outcome = await runCommand(userInput, {
      messages,
      config,
      terminal,
      rebuildSystemPrompt,
    });
    if (outcome === 'handled') continue;
    messages.push({ role: 'user', content: userInput });

    const abort = new AbortController();
    const onKeypress = (
      _s: string | undefined,
      key: { name?: string } | undefined,
    ) => {
      if (key?.name === 'escape') abort.abort('user-interrupt');
    };
    const wasRaw = process.stdin.isRaw ?? false;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.on('keypress', onKeypress);

    const result = streamText({
      model,
      messages,
      tools,
      stopWhen: stepCountIs(config.maxSteps),
      abortSignal: abort.signal,
    });

    process.stdout.write(pc.bold(pc.cyan('\nAssistant: ')));
    let lineOpen = true;
    let streamAborted = false;

    try {
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta': {
            process.stdout.write(part.text);
            lineOpen = !part.text.endsWith('\n');
            break;
          }
          case 'tool-call': {
            if (lineOpen) process.stdout.write('\n');
            process.stdout.write(
              pc.dim(`→ ${part.toolName}(${formatArgs(part.input)})\n`),
            );
            lineOpen = false;
            break;
          }
          case 'tool-result': {
            process.stdout.write(
              pc.green(`← ${part.toolName} ${formatResultSummary(part.output)}\n`),
            );
            lineOpen = false;
            break;
          }
          case 'tool-error': {
            process.stdout.write(
              pc.red(`← ${part.toolName} ${formatErrorSummary(part.error)}\n`),
            );
            lineOpen = false;
            break;
          }
          case 'error': {
            if (lineOpen) process.stdout.write('\n');
            process.stdout.write(
              pc.red(`[stream error] ${formatErrorSummary(part.error)}\n`),
            );
            lineOpen = false;
            streamAborted = true;
            break;
          }
        }
        if (streamAborted) break;
      }

      if (lineOpen) process.stdout.write('\n');
      process.stdout.write('\n');

      if (abort.signal.aborted && abort.signal.reason === 'user-interrupt') {
        process.stdout.write(pc.yellow('[aborted]\n\n'));
        messages.pop();
      } else if (!streamAborted) {
        const [finishReason, response] = await Promise.all([
          result.finishReason,
          result.response,
        ]);
        if (finishReason === 'tool-calls') {
          process.stdout.write(
            pc.dim(
              `· step cap (${config.maxSteps}) reached — send any message to continue\n`,
            ),
          );
        }
        messages.push(...response.messages);
      }
    } catch (err) {
      if (lineOpen) process.stdout.write('\n');
      if (abort.signal.aborted && abort.signal.reason === 'user-interrupt') {
        process.stdout.write(pc.yellow('[aborted]\n\n'));
        messages.pop();
      } else {
        process.stdout.write(pc.red(`[stream error] ${formatErrorSummary(err)}\n\n`));
      }
    } finally {
      process.stdin.off('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
