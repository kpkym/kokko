import { tool } from 'ai';
import { z } from 'zod';
import { search, DEFAULT_TOP_K } from '../embeddings';

export const get_information = tool({
  description:
    'Semantic search over content explicitly indexed via the /index command (Pinecone + Voyage embeddings). ' +
    'Use for material the user indexed: notes, prior conversations, external docs. ' +
    'Do NOT use for files in the current working directory — use read_file/grep/glob instead; the index does not track cwd. ' +
    'Do NOT use for general web knowledge — use web_search instead. ' +
    'Returns { hits: [{ source, content, similarity }] } with similarity in [0,1] rounded to 4 decimals (top 5 by default), ' +
    'or { hits: [], note } when nothing matches. Synthesize an answer from the snippets — do not dump them verbatim.',
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .describe(
        'A retrieval query — keyword-rich and self-contained. Reformulate the user\'s sentence into the key concepts, names, or terms you expect to appear in matching documents; do not pass the user message verbatim.',
      ),
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
