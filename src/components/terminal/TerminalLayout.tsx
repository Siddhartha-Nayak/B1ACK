import { Icon } from '../ui/Icon';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { arrange, resizePane, MIN_HEIGHT, type PaneRect } from '../../features/layout/geometry';
import type { Workspace, TerminalState, TerminalSession, PaneSize } from '../../types/workspace';
import type { TerminalController } from '../../services/terminal/TerminalController';
import { TerminalCard } from './TerminalCard';
interface Props {
  workspace: Workspace;
  states: Record<string, TerminalState>;
  controller: TerminalController;
  narrow: boolean;
  maximized: string | null;
  select(id: string): void;
  rename(id: string): void;
  close(id: string): void;
  start(t: TerminalSession): void;
  maximize(id: string): void;
  hide(id: string): void;
  reorder(id: string, before: string): void;
  saveSizes(sizes: Record<string, PaneSize>): void;
  shortcuts(e: KeyboardEvent): boolean;
}
const STOPPED: TerminalState = { status: 'Stopped' };
type Gesture = {
  kind: 'drag' | 'x' | 'y';
  id: string;
  x: number;
  y: number;
  panes: PaneRect[];
  sizes: Record<string, PaneSize>;
  next?: Record<string, PaneSize>;
  target?: string;
};
function ViewSlot({ root, children }: { root: HTMLDivElement | null; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root,
      rootMargin: '80px',
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [root]);
  return (
    <div ref={ref} className="viewport-slot">
      {visible ? children : <div className="offscreen-pane" />}
    </div>
  );
}
export function TerminalLayout(props: Props) {
  const { workspace: w, narrow, maximized } = props;
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [bounds, setBounds] = useState({ width: 800, height: 600 });
  const [preview, setPreview] = useState<Record<string, PaneSize> | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const gesture = useRef<Gesture | null>(null);
  useEffect(() => {
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      // Fractional display scaling must not round a pane beyond its content box.
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setBounds((old) => (old.width === width && old.height === height ? old : { width, height }));
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);
  const single = narrow || w.layout === 'tabs' || !!maximized;
  const ids = single
    ? [maximized ?? w.activeTerminalId ?? w.terminals[0]?.id].filter((id): id is string => !!id)
    : w.terminals.filter((t) => w.visibleTerminalIds.includes(t.id)).map((t) => t.id);
  const layout = single
    ? {
        columns: 1,
        height: Math.max(MIN_HEIGHT, bounds.height),
        panes: ids.map(
          (id) =>
            ({
              id,
              x: 0,
              y: 0,
              width: bounds.width,
              height: Math.max(MIN_HEIGHT, bounds.height),
              row: 0,
              rowIds: [id],
            }) as PaneRect,
        ),
      }
    : arrange(
        ids,
        bounds.width,
        bounds.height,
        w.gridColumns,
        preview ?? w.paneSizes,
        w.layout === 'split',
      );
  const begin = (event: PointerEvent<HTMLButtonElement>, id: string, kind: Gesture['kind']) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = {
      kind,
      id,
      x: event.clientX,
      y: event.clientY,
      panes: layout.panes,
      sizes: w.paneSizes,
    };
    if (kind === 'drag') setDragging(id);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'drag') {
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-pane-id]')?.dataset.paneId;
      g.target = target && target !== g.id ? target : undefined;
      setDrop(g.target ?? null);
    } else {
      const pane = g.panes.find((p) => p.id === g.id)!;
      g.next = resizePane(
        pane,
        g.panes,
        g.sizes,
        g.kind,
        g.kind === 'x' ? event.clientX - g.x : event.clientY - g.y,
      );
      setPreview(g.next);
    }
  };
  const finish = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel) {
      if (g.kind === 'drag' && g.target) props.reorder(g.id, g.target);
      else if (g.next) props.saveSizes(g.next);
    }
    setPreview(null);
    setDrop(null);
    setDragging(null);
  };
  return (
    <div
      className={`terminal-layout-scroll ${single ? 'single-layout' : ''} ${dragging ? 'reordering' : ''}`}
      ref={setRoot}
      data-columns={layout.columns}
      aria-label="Terminal workspace"
    >
      <div className="pane-canvas" style={{ height: layout.height }}>
        {layout.panes.map((pane) => {
          const terminal = w.terminals.find((t) => t.id === pane.id);
          if (!terminal) return null;
          return (
            <div
              key={pane.id}
              data-pane-id={pane.id}
              className={`pane-slot ${drop === pane.id ? 'drop-before' : ''} ${dragging === pane.id ? 'drag-source' : ''}`}
              style={{ left: pane.x, top: pane.y, width: pane.width, height: pane.height }}
            >
              <ViewSlot root={root}>
                <TerminalCard
                  session={terminal}
                  state={props.states[pane.id] ?? STOPPED}
                  active={w.activeTerminalId === pane.id}
                  controller={props.controller}
                  select={props.select}
                  rename={props.rename}
                  close={props.close}
                  start={props.start}
                  shortcuts={props.shortcuts}
                  maximize={props.maximize}
                  hide={props.hide}
                  maximized={maximized === pane.id}
                  dragHandle={
                    !single ? (
                      <button
                        className="drag-handle"
                        aria-label={`Move ${terminal.name}`}
                        title="Drag to reorder; Alt+Left/Right moves one position"
                        onPointerDown={(e) => begin(e, pane.id, 'drag')}
                        onPointerMove={move}
                        onPointerUp={(e) => finish(e)}
                        onPointerCancel={(e) => finish(e, true)}
                        onKeyDown={(e) => {
                          if (e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                            e.preventDefault();
                            const index = ids.indexOf(pane.id);
                            const target = e.key === 'ArrowLeft' ? ids[index - 1] : ids[index + 2];
                            if (target) props.reorder(pane.id, target);
                            else if (e.key === 'ArrowRight' && ids[index + 1])
                              props.reorder(ids[index + 1], pane.id);
                          }
                        }}
                      >
                        <Icon name="grip" size={12} />
                      </button>
                    ) : undefined
                  }
                />
              </ViewSlot>
              {!single && pane.nextId && (
                <button
                  className="pane-resize horizontal"
                  aria-label={`Resize ${terminal.name} horizontally`}
                  role="separator"
                  aria-orientation="vertical"
                  aria-valuenow={Math.round(pane.width)}
                  onPointerDown={(e) => begin(e, pane.id, 'x')}
                  onPointerMove={move}
                  onPointerUp={(e) => finish(e)}
                  onPointerCancel={(e) => finish(e, true)}
                  onKeyDown={(e) => {
                    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                      e.preventDefault();
                      props.saveSizes(
                        resizePane(
                          pane,
                          layout.panes,
                          w.paneSizes,
                          'x',
                          e.key === 'ArrowLeft' ? -24 : 24,
                        ),
                      );
                    }
                  }}
                />
              )}
              {!single && (
                <button
                  className="pane-resize vertical"
                  aria-label={`Resize ${terminal.name} vertically`}
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuenow={Math.round(pane.height)}
                  onPointerDown={(e) => begin(e, pane.id, 'y')}
                  onPointerMove={move}
                  onPointerUp={(e) => finish(e)}
                  onPointerCancel={(e) => finish(e, true)}
                  onKeyDown={(e) => {
                    if (['ArrowUp', 'ArrowDown'].includes(e.key)) {
                      e.preventDefault();
                      props.saveSizes(
                        resizePane(
                          pane,
                          layout.panes,
                          w.paneSizes,
                          'y',
                          e.key === 'ArrowUp' ? -24 : 24,
                        ),
                      );
                    }
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      {!ids.length && (
        <div className="no-panes">
          No terminals selected. Use “Visible terminals” to add panes; hidden sessions keep running.
        </div>
      )}
    </div>
  );
}
