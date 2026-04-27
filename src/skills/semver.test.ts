import { test, expect } from 'bun:test';
import { compareSemver, pickHighestVersion } from './semver';

test('compareSemver: equal versions return 0', () => {
  expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
});

test('compareSemver: lower major returns negative', () => {
  expect(compareSemver('1.0.0', '2.0.0')).toBeLessThan(0);
});

test('compareSemver: higher major returns positive', () => {
  expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
});

test('compareSemver: minor difference', () => {
  expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
});

test('compareSemver: patch difference', () => {
  expect(compareSemver('1.2.3', '1.2.10')).toBeLessThan(0);
});

test('pickHighestVersion: returns highest among valid versions', () => {
  expect(pickHighestVersion(['1.0.0', '5.0.7', '5.1.0', '2.3.4'])).toBe('5.1.0');
});

test('pickHighestVersion: skips non-semver entries', () => {
  expect(pickHighestVersion(['1.0.0', 'README.md', '2.0.0', 'tmp'])).toBe('2.0.0');
});

test('pickHighestVersion: returns null when no valid semver entries', () => {
  expect(pickHighestVersion(['README.md', 'foo'])).toBeNull();
});

test('pickHighestVersion: returns null on empty input', () => {
  expect(pickHighestVersion([])).toBeNull();
});

test('pickHighestVersion: handles single entry', () => {
  expect(pickHighestVersion(['3.4.5'])).toBe('3.4.5');
});
