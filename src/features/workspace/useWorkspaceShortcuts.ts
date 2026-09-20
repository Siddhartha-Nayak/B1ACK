import { useCallback, useEffect, useRef } from 'react';
export function useWorkspaceShortcuts({
  disabled,
  ids,
  active,
  newTerminal,
  addProject,
  close,
  select,
  search,
}: {
  disabled: boolean;
  ids: string[];
  active: string | null;
  newTerminal(): void;
  addProject(): void;
  close(id: string): void;
  select(id: string): void;
  search(): void;
}) {
  const handler = useRef<(e: KeyboardEvent) => boolean>(() => true);
  handler.current = (e) => {
    if (
      e.type !== 'keydown' ||
      e.defaultPrevented ||
      !(e.ctrlKey || e.metaKey) ||
      e.altKey ||
      disabled
    )
      return true;
    const key = e.key.toLowerCase();
    if (
      (e.target as HTMLElement)?.closest('.xterm') &&
      !e.shiftKey &&
      ['n', 'o', 'w', 'k'].includes(key)
    )
      return true;
    let action: (() => void) | undefined;
    if (key === 'n') action = newTerminal;
    else if (key === 'o') action = addProject;
    else if (key === 'w' && active) action = () => close(active);
    else if (key === 'k') action = search;
    else if (key === 'tab' && ids.length)
      action = () =>
        select(
          ids[
            (Math.max(0, ids.indexOf(active ?? '')) + (e.shiftKey ? -1 : 1) + ids.length) %
              ids.length
          ],
        );
    else if (/^[1-9]$/.test(key) && ids[Number(key) - 1])
      action = () => select(ids[Number(key) - 1]);
    if (action) {
      e.preventDefault();
      action();
      return false;
    }
    return true;
  };
  const callback = useCallback((e: KeyboardEvent) => handler.current(e), []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      callback(e);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [callback]);
  return callback;
}
