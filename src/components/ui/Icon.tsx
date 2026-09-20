import type { CSSProperties } from 'react';
type Name =
  | 'menu'
  | 'search'
  | 'plus'
  | 'more'
  | 'close'
  | 'restart'
  | 'maximize'
  | 'restore'
  | 'grid'
  | 'tabs'
  | 'split'
  | 'terminal'
  | 'grip'
  | 'chevronDown'
  | 'chevronRight';
const paths: Record<Name, string> = {
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M16 16l4 4M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  close: 'M6 6l12 12M18 6L6 18',
  restart: 'M4 10a8 8 0 1 1 1 8M4 4v6h6',
  maximize: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
  restore: 'M9 3h12v12M3 9h12v12H3z',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  tabs: 'M3 6h18v14H3zM3 6V3h8v3',
  split: 'M3 4h18v16H3zM12 4v16',
  terminal: 'M4 6l6 6-6 6M13 18h7',
  grip: 'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
};
export function Icon({ name, size = 16 }: { name: Name; size?: number }) {
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' || name === 'grip' ? 3 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 } as CSSProperties}
    >
      <path d={paths[name]} />
    </svg>
  );
}
