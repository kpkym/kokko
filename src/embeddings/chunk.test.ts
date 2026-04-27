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
});
