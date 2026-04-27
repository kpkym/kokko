export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 100;

export function chunk(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (size <= 0) throw new Error(`chunk size must be > 0 (got ${size})`);
  if (overlap < 0 || overlap >= size) {
    throw new Error(`overlap must be in [0, size) (got ${overlap}, size ${size})`);
  }
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed === '') return [];
  if (trimmed.length <= size) return [trimmed];

  const out: string[] = [];
  const step = size - overlap;
  for (let i = 0; i < trimmed.length; i += step) {
    const slice = trimmed.slice(i, i + size).trim();
    if (slice !== '') out.push(slice);
    if (i + size >= trimmed.length) break;
  }
  return out;
}
