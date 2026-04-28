import { tool } from 'ai';
import { z } from 'zod';
import Exa from 'exa-js';

const NUM_RESULTS_DEFAULT = 5;
const NUM_RESULTS_MAX = 10;
const QUERY_MAX = 500;
const CONTENT_CAP = 2000;
const LIVECRAWL_DEFAULT = 'fallback' as const;

type Livecrawl = 'always' | 'fallback' | 'never';

function getClient(): Exa {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('Missing required env var: EXA_API_KEY');
  return new Exa(key);
}

export const web_search = tool({
  description:
    'Search the web via Exa. Returns title, URL, snippet (first 2000 chars), and published date for each result. ' +
    "livecrawl controls freshness: 'fallback' (default) serves cached pages and only fetches when missing — fast and cheap, fine for most queries; " +
    "'always' forces a fresh fetch — slower and costlier, use for time-sensitive queries (current events, breaking news, recent changes); " +
    "'never' uses cache only.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .max(QUERY_MAX)
      .describe('The search query.'),
    num_results: z
      .number()
      .int()
      .min(1)
      .max(NUM_RESULTS_MAX)
      .optional()
      .describe(`How many results to return (1..${NUM_RESULTS_MAX}). Default ${NUM_RESULTS_DEFAULT}.`),
    livecrawl: z
      .enum(['always', 'fallback', 'never'])
      .optional()
      .describe(
        `Freshness policy. Default '${LIVECRAWL_DEFAULT}'. Use 'always' only when the answer must reflect today's web.`,
      ),
  }),
  execute: async ({ query, num_results, livecrawl }) => {
    const lc: Livecrawl = livecrawl ?? LIVECRAWL_DEFAULT;
    const n = num_results ?? NUM_RESULTS_DEFAULT;
    const { results } = await getClient().searchAndContents(query, {
      livecrawl: lc,
      numResults: n,
    });
    return results.map((r) => ({
      title: r.title,
      url: r.url,
      content: r.text.slice(0, CONTENT_CAP),
      publishedDate: r.publishedDate,
    }));
  },
});
