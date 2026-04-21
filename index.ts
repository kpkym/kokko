import { streamText, type ModelMessage } from 'ai';
import * as readline from 'node:readline/promises';
import { config, resolveModel } from './config';

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: ModelMessage[] = [];

async function main() {
  const model = resolveModel();
  console.log(`kokko CLI [${config.provider}:${config.model}] — type a message, Ctrl+C to exit.\n`);

  while (true) {
    const userInput = await terminal.question('You: ');
    messages.push({ role: 'user', content: userInput });

    const result = streamText({
      model,
      messages,
    });

    let fullResponse = '';
    process.stdout.write('\nAssistant: ');
    for await (const delta of result.textStream) {
      fullResponse += delta;
      process.stdout.write(delta);
    }
    process.stdout.write('\n\n');

    messages.push({ role: 'assistant', content: fullResponse });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
