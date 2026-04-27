import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

const searchAndContents = mock(async (_q: string, _opts: unknown) => ({
  results: [
    {
      title: 'Example',
      url: 'https://example.com/a',
      text: 'a'.repeat(2000),
      publishedDate: '2026-01-02',
    },
  ],
}));

mock.module('exa-js', () => ({
  default: class {
    searchAndContents = searchAndContents;
  },
}));

const { buildTools } = await import('./index');
const { ctx } = await import('./test-helpers');
const tools = buildTools({ skills: [] });

describe('web_search', () => {
  const prevKey = process.env.EXA_API_KEY;

  beforeEach(() => {
    process.env.EXA_API_KEY = 'test-key';
    searchAndContents.mockClear();
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.EXA_API_KEY;
    else process.env.EXA_API_KEY = prevKey;
  });

  test('returns trimmed results from exa', async () => {
    const out = await tools.web_search.execute!({ query: 'hello' }, ctx);
    expect(searchAndContents).toHaveBeenCalledTimes(1);
    expect(searchAndContents.mock.calls[0]?.[0]).toBe('hello');
    expect(out).toEqual([
      {
        title: 'Example',
        url: 'https://example.com/a',
        content: 'a'.repeat(1000),
        publishedDate: '2026-01-02',
      },
    ]);
  });

  test('throws when EXA_API_KEY is missing', async () => {
    delete process.env.EXA_API_KEY;
    await expect(
      tools.web_search.execute!({ query: 'hello' }, ctx),
    ).rejects.toThrow(/EXA_API_KEY/);
  });
});
