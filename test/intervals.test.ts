import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: -50, max: 50 }), fc.integer({ min: -50, max: 50 }))
  .map(([a, b]) => [Math.min(a, b), Math.max(a, b)]);

const intervalList = fc.array(interval);

// Sorted intervals with a gap of at least 1 between them
const disjointList = fc
  .tuple(
    fc.integer({ min: -50, max: 50 }),
    fc.array(fc.tuple(fc.integer({ min: 1, max: 5 }), fc.nat(5))), // [gap, length]
  )
  .map(([start, parts]) => {
    const out: Interval[] = [];
    let pos = start;
    for (const [gap, len] of parts) {
      const s = pos + gap;
      out.push([s, s + len]);
      pos = s + len;
    }
    return out;
  });

const covered = (list: Interval[], p: number) =>
  list.some(([s, e]) => s <= p && p <= e);

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. Output is sorted with a gap between consecutive intervals.
  it('every interval in output must have gap between consecutive intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let i = 0; i + 1 < out.length; i++) {
          expect(out[i][1]).toBeLessThan(out[i + 1][0]);
        }
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified.
  it('does not modify the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const before = structuredClone(xs);
        mergeIntervals(xs);
        expect(xs).toEqual(before);
      }),
    );
  });

  // Pattern: differential. Input and output cover the same points
  it('covers exactly the same points as the input', () => {
    fc.assert(
      fc.property(intervalList, fc.integer({ min: -60, max: 60 }), (xs, p) => {
        const out = mergeIntervals(xs);
        expect(covered(out, p)).toBe(covered(xs, p));
        expect(covered(out, p + 0.5)).toBe(covered(xs, p + 0.5));
      }),
    );
  });

  // Pattern: metamorphic. Reordering the input doesn't change the output.
  it('order of input does not matter', () => {
    const withShuffle = intervalList.chain(xs =>
      fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length })),
    );
    fc.assert(
      fc.property(withShuffle, ([xs, shuffled]) => {
        expect(mergeIntervals(shuffled)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: algebraic. Merging is idempotent.
  it('merging twice equals merging once', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. If input is disjoint, the output is the input sorted.
  it('disjoint input is returned sorted and unchanged', () => {
    fc.assert(
      fc.property(disjointList, xs => {
        const shuffled = [...xs].reverse();
        expect(mergeIntervals(shuffled)).toEqual(xs);
      }),
    );
  });
});
