import { describe, it, expect } from 'vitest';
import { arrange, resizePane, MIN_WIDTH, MIN_HEIGHT } from './geometry';
describe('adaptive terminal geometry', () => {
  it('uses the workspace for 1, 4, 9 and 16 panes without a fixed cap', () => {
    for (const [n, c] of [
      [1, 1],
      [4, 2],
      [9, 3],
      [16, 4],
    ]) {
      const r = arrange(
        Array.from({ length: n }, (_, i) => String(i)),
        1600,
        1000,
        null,
        {},
      );
      expect(r.columns).toBe(c);
      expect(r.panes).toHaveLength(n);
      expect(r.panes.every((p) => p.width >= MIN_WIDTH && p.height >= MIN_HEIGHT)).toBe(true);
    }
  });
  it('adapts to available width and scrolls vertically without losing panes', () => {
    const r = arrange(
      Array.from({ length: 20 }, (_, i) => String(i)),
      600,
      600,
      null,
      {},
    );
    expect(r.columns).toBeLessThanOrEqual(2);
    expect(r.height).toBeGreaterThan(600);
    expect(r.panes).toHaveLength(20);
  });
  it('allows manual columns above six when the available width permits', () => {
    expect(
      arrange(
        Array.from({ length: 40 }, (_, i) => String(i)),
        3000,
        900,
        10,
        {},
      ).columns,
    ).toBe(10);
  });
  it('resizes neighboring widths and row height without changing identities', () => {
    const r = arrange(['a', 'b', 'c', 'd'], 1400, 800, 2, {});
    let sizes = resizePane(r.panes[0], r.panes, {}, 'x', 200);
    const next = arrange(['a', 'b', 'c', 'd'], 1400, 800, 2, sizes);
    expect(next.panes[0].width).toBeGreaterThan(next.panes[1].width * 1.7);
    sizes = resizePane(next.panes[0], next.panes, sizes, 'y', 100);
    const resized = arrange(['a', 'b', 'c', 'd'], 1400, 800, 2, sizes);
    expect(resized.panes[0].height).toBe(next.panes[0].height + 100);
    expect(resized.panes.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
