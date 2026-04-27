import { embed as aiEmbed, embedMany as aiEmbedMany } from 'ai';
import { createVoyage } from 'voyage-ai-provider';

export const DEFAULT_MODEL = 'voyage-3-large';

export type InputType = 'document' | 'query';

function getModel(inputType: InputType) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('Missing required env var: VOYAGE_API_KEY');
  const modelName = process.env.KOKKO_VOYAGE_MODEL ?? DEFAULT_MODEL;
  const baseURL = process.env.VOYAGE_BASE_URL;
  const voyage = createVoyage({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return voyage.textEmbeddingModel(modelName, { inputType });
}

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await aiEmbed({ model: getModel('query'), value: text });
  return embedding;
}

export async function embedDocuments(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];
  const { embeddings } = await aiEmbedMany({ model: getModel('document'), values });
  return embeddings;
}
