import { useEffect, useRef } from 'react';
import type { TerminalView } from '../../services/terminal/TerminalView';
import '@xterm/xterm/css/xterm.css';
export function TerminalPane({
  view,
  shortcuts,
}: {
  view: TerminalView;
  shortcuts: (event: KeyboardEvent) => boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current!;
    // xterm's dispose releases listeners but can leave its old DOM in the pane.
    // A restarted process must mount into an empty surface.
    element.replaceChildren();
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void view.mount(element, shortcuts).then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [view, shortcuts]);
  return <div ref={ref} className="terminal-surface" />;
}
