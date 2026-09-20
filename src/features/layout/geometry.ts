import type { PaneSize } from '../../types/workspace';
export const MIN_WIDTH = 280;
export const MIN_HEIGHT = 210;
export const GAP = 8;
export interface PaneRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  nextId?: string;
  rowIds: string[];
}
export function autoColumns(count: number, width: number, height: number): number {
  if (count <= 1) return 1;
  const max = Math.max(1, Math.min(count, Math.floor((width + GAP) / (MIN_WIDTH + GAP))));
  let best = 1;
  let score = Infinity;
  for (let cols = 1; cols <= max; cols++) {
    const rows = Math.ceil(count / cols);
    const w = (width - GAP * (cols - 1)) / cols;
    const h = Math.max(MIN_HEIGHT, (height - GAP * (rows - 1)) / rows);
    const candidate =
      Math.abs(Math.log(w / h / 1.6)) +
      ((cols * rows - count) / count) * 0.5 +
      (rows * MIN_HEIGHT > height ? 0.12 : 0);
    if (candidate < score) {
      score = candidate;
      best = cols;
    }
  }
  return best;
}
function widths(total: number, weights: number[], minimum: number) {
  const result = weights.map(() => 0);
  let left = weights.map((_, i) => i);
  let available = total;
  while (left.length) {
    const sum = left.reduce((s, i) => s + weights[i], 0);
    const small = left.filter((i) => (available * weights[i]) / sum < minimum);
    if (!small.length) {
      for (const i of left) result[i] = (available * weights[i]) / sum;
      break;
    }
    for (const i of small) {
      result[i] = minimum;
      available -= minimum;
    }
    left = left.filter((i) => !small.includes(i));
  }
  return result;
}
export function arrange(
  ids: string[],
  width: number,
  height: number,
  requested: number | null,
  sizes: Record<string, PaneSize>,
  split = false,
): { panes: PaneRect[]; height: number; columns: number } {
  const usable = Math.max(1, width);
  const maxColumns = Math.max(1, Math.floor((usable + GAP) / (MIN_WIDTH + GAP)));
  const columns = Math.max(
    1,
    Math.min(
      ids.length || 1,
      maxColumns,
      split ? 2 : (requested ?? autoColumns(ids.length, usable, height)),
    ),
  );
  const rows = Math.ceil(ids.length / columns);
  const defaultHeight = Math.max(MIN_HEIGHT, (height - GAP * (rows - 1)) / Math.max(1, rows));
  const panes: PaneRect[] = [];
  let y = 0;
  for (let row = 0; row < rows; row++) {
    const rowIds = ids.slice(row * columns, (row + 1) * columns);
    const rowHeight = Math.max(
      MIN_HEIGHT,
      ...rowIds.map((id) => sizes[id]?.height ?? defaultHeight),
    );
    const rowWidths = widths(
      usable - GAP * (rowIds.length - 1),
      rowIds.map((id) => sizes[id]?.weight ?? 1),
      Math.min(MIN_WIDTH, usable),
    );
    let x = 0;
    rowIds.forEach((id, i) => {
      panes.push({
        id,
        x,
        y,
        width: rowWidths[i],
        height: rowHeight,
        row,
        nextId: rowIds[i + 1],
        rowIds,
      });
      x += rowWidths[i] + GAP;
    });
    y += rowHeight + GAP;
  }
  return { panes, height: Math.max(height, y - GAP), columns };
}
export function resizePane(
  pane: PaneRect,
  panes: PaneRect[],
  sizes: Record<string, PaneSize>,
  axis: 'x' | 'y',
  delta: number,
): Record<string, PaneSize> {
  const next = { ...sizes };
  if (axis === 'x' && pane.nextId) {
    const neighbor = panes.find((p) => p.id === pane.nextId)!;
    const total = pane.width + neighbor.width;
    const width = Math.max(MIN_WIDTH, Math.min(total - MIN_WIDTH, pane.width + delta));
    for (const p of panes.filter((p) => p.row === pane.row))
      next[p.id] = { ...next[p.id], weight: p.width };
    next[pane.id].weight = width;
    next[neighbor.id].weight = total - width;
  } else if (axis === 'y') {
    const height = Math.min(10000, Math.max(MIN_HEIGHT, pane.height + delta));
    for (const id of pane.rowIds) next[id] = { ...next[id], weight: next[id]?.weight ?? 1, height };
  }
  return next;
}
