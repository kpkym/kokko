import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

const NUM_RESULTS = 3;
const CONTENT_CAP = 1000;

function getClient(): Exa {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('Missing required env var: EXA_API_KEY');
  return new Exa(key);
}

export const web_search = tool({
  description: 'Search the web for up-to-date information. Returns titles, URLs, snippets, and published dates.',
  inputSchema: z.object({
    query: z.string().min(1).max(100).describe('The search query'),
  }),
  execute: async ({ query }) => {
    const { results } = await getClient().searchAndContents(query, {
      livecrawl: 'always',
      numResults: NUM_RESULTS,
    });
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.text.slice(0, CONTENT_CAP),
      publishedDate: r.publishedDate,
    }));
  },
});
