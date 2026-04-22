import { streamText, stepCountIs, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { config, resolveModel } from './config';
import { tools } from './tools';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

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
  const s = typeof output === 'string' ? output : JSON.stringify(output);
  return `ok (${s.length} chars)`;
}

function formatErrorSummary(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `ERROR: ${truncate(msg, 200)}`;
}

async function main() {
  const model = resolveModel();
  console.log(
    `kokko CLI [${config.provider}:${config.model}] — type a message, Ctrl+C to exit.\n`,
  );

  while (true) {
    const userInput = await terminal.question('You: ');
    messages.push({ role: 'user', content: userInput });

    const result = streamText({
      model,
      messages,
      tools,
      stopWhen: stepCountIs(config.maxSteps),
    });

    process.stdout.write('\nAssistant: ');
    let lineOpen = true;

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
            process.stdout.write(`→ ${part.toolName}(${formatArgs(part.input)})\n`);
            lineOpen = false;
            break;
          }
          case 'tool-result': {
            process.stdout.write(
              `← ${part.toolName} ${formatResultSummary(part.output)}\n`,
            );
            lineOpen = false;
            break;
          }
          case 'tool-error': {
            process.stdout.write(
              `← ${part.toolName} ${formatErrorSummary(part.error)}\n`,
            );
            lineOpen = false;
            break;
          }
          case 'error': {
            if (lineOpen) process.stdout.write('\n');
            process.stdout.write(`[stream error] ${formatErrorSummary(part.error)}\n`);
            lineOpen = false;
            break;
          }
        }
      }

      if (lineOpen) process.stdout.write('\n');
      process.stdout.write('\n');

      const response = await result.response;
      messages.push(...response.messages);
    } catch (err) {
      if (lineOpen) process.stdout.write('\n');
      process.stdout.write(`[stream error] ${formatErrorSummary(err)}\n\n`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
