import { describe, expect, test } from 'bun:test';
import { chunk } from './chunk';

describe('chunk', () => {
  test('empty input → empty array', () => {
    expect(chunk('')).toEqual([]);
    expect(chunk('   \n  ')).toEqual([]);
  });

  test('short input → single chunk', () => {
    expect(chunk('hello world', 100, 10)).toEqual(['hello world']);
  });

  test('splits with overlap', () => {
    const text = 'a'.repeat(250);
    const out = chunk(text, 100, 20);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((c) => c.length <= 100)).toBe(true);
    expect(out[0]?.length).toBe(100);
  });

  test('normalizes CRLF and trims', () => {
    expect(chunk('  hi\r\nthere  ', 100, 10)).toEqual(['hi\nthere']);
  });

  test('rejects bad params', () => {
    expect(() => chunk('x', 0, 0)).toThrow(/size/);
    expect(() => chunk('x', 100, 100)).toThrow(/overlap/);
    expect(() => chunk('x', 100, -1)).toThrow(/overlap/);
  });

  test('packs short paragraphs into one chunk when they fit', () => {
    const text = 'first para.\n\nsecond para.\n\nthird para.';
    expect(chunk(text, 100, 0)).toEqual([
      'first para.\n\nsecond para.\n\nthird para.',
    ]);
  });

  test('flushes on paragraph boundary when next would overflow', () => {
    const a = 'a'.repeat(60);
    const b = 'b'.repeat(60);
    expect(chunk(`${a}\n\n${b}`, 100, 0)).toEqual([a, b]);
  });

  test('oversize single paragraph falls back to char split with overlap', () => {
    const out = chunk('x'.repeat(250), 100, 20);
    expect(out.length).toBe(3);
    expect(out[0]?.length).toBe(100);
    expect(out.every((c) => c.length <= 100)).toBe(true);
  });

  test('oversize block flushes prior buffer and is char-split between short blocks', () => {
    const big = 'b'.repeat(150);
    const out = chunk(`intro\n\n${big}\n\nouter`, 100, 20);
    expect(out[0]).toBe('intro');
    expect(out[out.length - 1]).toBe('outer');
    expect(out.length).toBeGreaterThan(2);
  });

  test('collapses multi-blank-line breaks to a single boundary', () => {
    const out = chunk('alpha\n\n\n\nbeta', 100, 0);
    expect(out).toEqual(['alpha\n\nbeta']);
  });
});
