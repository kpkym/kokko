import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ToolExecutionOptions } from 'ai';

export const ctx: ToolExecutionOptions = { toolCallId: 't', messages: [] };

export async function makeTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'kokko-test-'));
}
