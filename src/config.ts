import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { devToolsMiddleware } from '@ai-sdk/devtools';
import { wrapLanguageModel, type LanguageModel } from 'ai';

export type Provider = 'openai' | 'anthropic';

export interface Config {
  provider: Provider;
  model: string;
  baseURL: string;
  maxSteps: number;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function readProvider(): Provider {
  const v = requireEnv('AI_PROVIDER').toLowerCase();
  if (v !== 'openai' && v !== 'anthropic') {
    throw new Error(`Invalid AI_PROVIDER: ${v} (expected "openai" or "anthropic")`);
  }
  return v;
}

function readMaxSteps(): number {
  const raw = process.env.AI_MAX_STEPS;
  if (raw === undefined || raw === '') return 50;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid AI_MAX_STEPS: ${raw} (expected positive integer)`);
  }
  return n;
}

function loadConfig(): Config {
  const provider = readProvider();
  switch (provider) {
    case 'openai':
      requireEnv('OPENAI_API_KEY');
      return {
        provider,
        model: requireEnv('OPENAI_MODEL'),
        baseURL: requireEnv('OPENAI_BASE_URL'),
        maxSteps: readMaxSteps(),
      };
    case 'anthropic':
      requireEnv('ANTHROPIC_API_KEY');
      return {
        provider,
        model: requireEnv('ANTHROPIC_MODEL'),
        baseURL: requireEnv('ANTHROPIC_BASE_URL'),
        maxSteps: readMaxSteps(),
      };
  }
}

export const config: Config = loadConfig();

export function resolveModel(cfg: Config = config): LanguageModel {
  const base = (() => {
    switch (cfg.provider) {
      case 'openai':
        return createOpenAI({ baseURL: cfg.baseURL })(cfg.model);
      case 'anthropic':
        return createAnthropic({ baseURL: cfg.baseURL })(cfg.model);
    }
  })();
  return wrapLanguageModel({
    model: base,
    middleware: devToolsMiddleware(),
  });
}
