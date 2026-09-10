// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  assertDifferentTeams,
  assertSelectionCount,
  toOdd,
} from './invariants.js';

describe('domain invariants', () => {
  it('keeps odds as decimal-safe strings', () => {
    expect(toOdd('1.10')).toBe('1.10');
    expect(toOdd('2.10')).toBe('2.10');
    expect(toOdd('12.50')).toBe('12.50');
  });

  it('rejects invalid fixture and bulletin structure', () => {
    expect(() => assertDifferentTeams('team-1', 'team-1')).toThrow();
    expect(() => assertSelectionCount('SINGLE', 2)).toThrow();
    expect(() => assertSelectionCount('MULTI', 1)).toThrow();
    expect(() => assertSelectionCount('MULTI', 11)).toThrow();
  });
});
