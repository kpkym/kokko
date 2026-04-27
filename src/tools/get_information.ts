import { tool } from 'ai';
import { z } from 'zod';
import { search, DEFAULT_TOP_K } from '../embeddings';

export const get_information = tool({
  description:
    'Search the indexed knowledge base for content relevant to a question. Use this when the user asks about indexed project documents, prior conversations, or anything that may have been added via the /index command. Returns up to a few snippets ranked by similarity.',
  inputSchema: z.object({
    question: z.string().min(1).describe("The user's question, in their own words."),
  }),
  execute: async ({ question }) => {
    const hits = await search(question, DEFAULT_TOP_K);
    if (hits.length === 0) {
      return { hits: [], note: 'no relevant content found in knowledge base' };
    }
    return {
      hits: hits.map((h) => ({
        source: h.source,
        content: h.content,
        similarity: Number(h.similarity.toFixed(4)),
      })),
    };
  },
});
