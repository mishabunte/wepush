import { describe, expect, it } from 'vitest';

import { isZeroDecimal } from '../src/shared/format';

describe('exact decimal formatting helpers', () => {
  it('recognizes formatted zero without converting through floating point', () => {
    expect(isZeroDecimal('0')).toBe(true);
    expect(isZeroDecimal('0.00')).toBe(true);
    expect(isZeroDecimal('000.000000000000000000')).toBe(true);
    expect(isZeroDecimal('0.000000000000000001')).toBe(false);
    expect(isZeroDecimal('10.00')).toBe(false);
  });
});
