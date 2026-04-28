export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 100;

const PARAGRAPH_BREAK = /\n{2,}/;

export function chunk(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (size <= 0) throw new Error(`chunk size must be > 0 (got ${size})`);
  if (overlap < 0 || overlap >= size) {
    throw new Error(`overlap must be in [0, size) (got ${overlap}, size ${size})`);
  }
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (trimmed === '') return [];

  const blocks: string[] = [];
  for (const para of trimmed.split(PARAGRAPH_BREAK)) {
    const t = para.trim();
    if (t !== '') blocks.push(t);
  }
  if (blocks.length === 0) return [];

  const joined = blocks.join('\n\n');
  if (joined.length <= size) return [joined];

  const out: string[] = [];
  let buf = '';
  const flush = () => {
    if (buf !== '') {
      out.push(buf);
      buf = '';
    }
  };

  for (const block of blocks) {
    if (block.length > size) {
      flush();
      for (const piece of charSplit(block, size, overlap)) out.push(piece);
      continue;
    }
    if (buf === '') {
      buf = block;
    } else if (buf.length + 2 + block.length <= size) {
      buf = `${buf}\n\n${block}`;
    } else {
      flush();
      buf = block;
    }
  }
  flush();
  return out;
}

function charSplit(text: string, size: number, overlap: number): string[] {
  const out: string[] = [];
  const step = size - overlap;
  for (let i = 0; i < text.length; i += step) {
    const slice = text.slice(i, i + size).trim();
    if (slice !== '') out.push(slice);
    if (i + size >= text.length) break;
  }
  return out;
}
