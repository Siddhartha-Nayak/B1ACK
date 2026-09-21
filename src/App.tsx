import { FileLibrary } from './components/library/FileLibrary';
import { Icon } from './components/ui/Icon';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { WorkspaceStore } from './features/workspace/WorkspaceStore';
import { localWorkspace } from './services/persistence/workspace';
import { desktopTerminal } from './services/terminal/LocalDesktopTerminal';
import { TerminalController } from './services/terminal/TerminalController';
import { desktopPlatform } from './services/platform';
import { Sidebar } from './components/layout/Sidebar';
import { WorkspaceDialogs, type Dialog } from './components/layout/WorkspaceDialogs';
import { TerminalLayout } from './components/terminal/TerminalLayout';
import { StatusBar } from './components/status/StatusBar';
import { useWorkspaceShortcuts } from './features/workspace/useWorkspaceShortcuts';
import type { TerminalSession } from './types/workspace';
const store = new WorkspaceStore(localWorkspace);
const controller = new TerminalController(desktopTerminal);
export function App() {
  const library = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const workspace = library.workspaces.find((w) => w.id === library.activeWorkspaceId)!;
  const states = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [error, setError] = useState(store.error || store.warning);
  const [narrow, setNarrow] = useState(innerWidth < 768);
  const [maximized, setMaximized] = useState<string | null>(null);
  const [sideWidth, setSideWidth] = useState<number | null>(null);
  const sideDrag = useRef<{ x: number; width: number } | null>(null);
  const project = workspace.projects.find((p) => p.id === workspace.activeProjectId);
  const terminals = workspace.terminals;
  const active = terminals.find((t) => t.id === workspace.activeTerminalId) ?? terminals[0];
  const run = useCallback((fn: () => void | Promise<void>) => {
    try {
      Promise.resolve(fn()).catch((e) => setError(String(e)));
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => (desktopPlatform.available ? controller.startPolling() : undefined), []);
  useEffect(() => {
    const mq = matchMedia('(max-width: 767px)');
    const listener = () => setNarrow(mq.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  useEffect(() => {
    setMaximized(null);
    setSideWidth(null);
  }, [workspace.id]);
  const select = useCallback(
    (id: string) =>
      run(() => {
        store.selectTerminal(id);
        setDrawer(false);
        setMaximized((current) => (current ? id : null));
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(`[data-pane-id="${id}"]`)
            ?.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
        );
      }),
    [run],
  );
  const start = useCallback((t: TerminalSession) => {
    void controller.start(t);
  }, []);
  const close = useCallback(
    (id: string) =>
      run(async () => {
        await controller.close(id);
        store.removeTerminal(id);
        setMaximized((current) => (current === id ? null : current));
      }),
    [run],
  );
  const rename = useCallback(
    (id: string) => setDialog({ kind: 'rename', id, target: 'terminal' }),
    [],
  );
  const addProject = () => {
    setError('');
    setDialog('project');
  };
  const newTerminal = () => setDialog(project ? 'terminal' : 'project');
  const shortcuts = useWorkspaceShortcuts({
    disabled: !!dialog || libraryOpen,
    ids: terminals.map((t) => t.id),
    active: active?.id ?? null,
    newTerminal,
    addProject,
    close,
    select,
    search: () => setDialog('search'),
  });
  const sidebarHidden = !narrow && workspace.sidebarCollapsed;
  return (
    <div
      className={`app-shell ${sidebarHidden ? 'sidebar-collapsed' : ''}`}
      style={{ '--sidebar-width': `${sideWidth ?? workspace.sidebarWidth}px` } as CSSProperties}
    >
      <header className="app-header">
        <button
          className="sidebar-toggle icon-button"
          aria-label={
            narrow ? 'Open projects' : sidebarHidden ? 'Show sidebar' : 'Collapse sidebar'
          }
          onClick={() =>
            narrow
              ? setDrawer(true)
              : run(() => store.update((w) => ({ ...w, sidebarCollapsed: !w.sidebarCollapsed })))
          }
        >
          <Icon name="menu" />
        </button>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <strong>
            Parallel<span>ADE</span>
          </strong>
          <small>DESKTOP</small>
        </div>
        <label className="workspace-picker">
          <span>WORKSPACE</span>
          <select
            aria-label="Current workspace"
            value={workspace.id}
            onChange={(e) => run(() => store.switchWorkspace(e.target.value))}
          >
            {library.workspaces.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="icon-button"
          aria-label="Manage workspaces"
          title="Create, rename or delete workspace"
          onClick={() => setDialog('workspaces')}
        >
          <Icon name="more" />
        </button>
        <button
          className="library-button"
          disabled={!desktopPlatform.available}
          onClick={() => setLibraryOpen((open) => !open)}
          aria-pressed={libraryOpen}
        >
          Library
        </button>
        <button className="search-button" onClick={() => setDialog('search')}>
          <Icon name="search" />
          <span className="search-label">Find a terminal</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>
      {libraryOpen && <FileLibrary close={() => setLibraryOpen(false)} />}
      {drawer && (
        <button
          className="drawer-scrim"
          aria-label="Dismiss projects"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside className={`sidebar ${drawer ? 'open' : ''} ${sidebarHidden ? 'collapsed' : ''}`}>
        <Sidebar
          workspace={workspace}
          library={library}
          store={store}
          platform={desktopPlatform}
          states={states}
          selectProject={(id) =>
            run(() => {
              store.selectProject(id);
              setDrawer(false);
            })
          }
          selectTerminal={select}
          add={addProject}
          rename={(id) => setDialog({ kind: 'rename', id, target: 'project' })}
          remove={(id) => setDialog({ kind: 'remove', id })}
          close={() => setDrawer(false)}
          run={run}
        />
        {!narrow && (
          <button
            className="sidebar-resize"
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuenow={Math.round(sideWidth ?? workspace.sidebarWidth)}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              sideDrag.current = { x: e.clientX, width: workspace.sidebarWidth };
            }}
            onPointerMove={(e) => {
              if (sideDrag.current)
                setSideWidth(
                  Math.min(
                    480,
                    Math.max(170, sideDrag.current.width + e.clientX - sideDrag.current.x),
                  ),
                );
            }}
            onPointerUp={(e) => {
              if (!sideDrag.current) return;
              sideDrag.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
              run(() => store.update((w) => ({ ...w, sidebarWidth: sideWidth ?? w.sidebarWidth })));
              setSideWidth(null);
            }}
            onPointerCancel={() => {
              sideDrag.current = null;
              setSideWidth(null);
            }}
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                run(() =>
                  store.update((w) => ({
                    ...w,
                    sidebarWidth: Math.max(
                      170,
                      Math.min(480, w.sidebarWidth + (e.key === 'ArrowRight' ? 20 : -20)),
                    ),
                  })),
                );
              }
            }}
          />
        )}
      </aside>
      <main className="workspace">
        <header className="workspace-header">
          <div className="workspace-title">
            <span className="eyebrow">
              <i className="live-pulse" aria-hidden="true" />
              CODE WORKSPACE · {workspace.name}
            </span>
            <h1>{project?.name ?? 'Your workspace'}</h1>
            <span className="workspace-path" title={project?.path ?? 'No project selected'}>
              {project?.path ?? 'No project selected'}
            </span>
          </div>
          <div className="workspace-actions">
            <div className="layout-switch" role="group" aria-label="Terminal layout">
              {(['tabs', 'grid', 'split'] as const).map((mode) => (
                <button
                  key={mode}
                  aria-label={mode[0].toUpperCase() + mode.slice(1)}
                  aria-pressed={workspace.layout === mode && !maximized}
                  onClick={() =>
                    run(() => {
                      setMaximized(null);
                      store.update((w) => ({ ...w, layout: mode }));
                    })
                  }
                >
                  <Icon name={mode} />
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
            {project && (
              <button
                className="agent-setup-trigger"
                onClick={() => setDialog('agents')}
                title="Check or install coding agents"
              >
                <Icon name="sparkles" /> Set up agents
              </button>
            )}
            <button
              className="primary new-terminal"
              aria-label="New terminal"
              disabled={!desktopPlatform.available}
              onClick={newTerminal}
            >
              <Icon name="plus" /> New terminal
            </button>
          </div>
        </header>
        {!desktopPlatform.available && (
          <div className="notice">Open the desktop app to run local terminals.</div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span>
            {store.error ? (
              <button
                onClick={() => {
                  if (
                    confirm('Replace unreadable saved configuration? Original v1 data is retained.')
                  )
                    run(() => {
                      store.reset();
                      setError('');
                    });
                }}
              >
                Reset saved workspace
              </button>
            ) : (
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                ×
              </button>
            )}
          </div>
        )}
        {terminals.length > 0 && (
          <>
            <div className="layout-options">
              {maximized ? (
                <button onClick={() => setMaximized(null)}>Restore layout</button>
              ) : workspace.layout === 'grid' ? (
                <>
                  <label>
                    Grid
                    <select
                      aria-label="Grid mode"
                      value={workspace.gridColumns === null ? 'auto' : 'manual'}
                      onChange={(e) =>
                        run(() =>
                          store.update((w) => ({
                            ...w,
                            gridColumns:
                              e.target.value === 'auto' ? null : Math.max(1, w.gridColumns ?? 2),
                          })),
                        )
                      }
                    >
                      <option value="auto">Auto</option>
                      <option value="manual">Manual columns</option>
                    </select>
                  </label>
                  {workspace.gridColumns !== null && (
                    <label>
                      Columns
                      <input
                        type="number"
                        min={1}
                        step={1}
                        aria-label="Grid columns"
                        value={workspace.gridColumns}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (Number.isSafeInteger(n) && n >= 1)
                            run(() => store.update((w) => ({ ...w, gridColumns: n })));
                        }}
                      />
                    </label>
                  )}
                </>
              ) : (
                <span className="muted">
                  {workspace.layout === 'split'
                    ? 'Drag pane boundaries to customize your split.'
                    : 'Independent sessions across this workspace.'}
                </span>
              )}
              {workspace.layout !== 'tabs' && (
                <>
                  <button onClick={() => run(() => store.update((w) => ({ ...w, paneSizes: {} })))}>
                    Reset pane sizes
                  </button>
                  <details className="visibility-picker">
                    <summary>Visible terminals ({workspace.visibleTerminalIds.length})</summary>
                    <div>
                      <div className="visibility-actions">
                        <button
                          onClick={() =>
                            run(() =>
                              store.update((w) => ({
                                ...w,
                                visibleTerminalIds: w.terminals.map((t) => t.id),
                              })),
                            )
                          }
                        >
                          Show all
                        </button>
                        <button
                          onClick={() =>
                            run(() => store.update((w) => ({ ...w, visibleTerminalIds: [] })))
                          }
                        >
                          Hide all
                        </button>
                      </div>
                      {terminals.map((t) => (
                        <label key={t.id}>
                          <input
                            type="checkbox"
                            checked={workspace.visibleTerminalIds.includes(t.id)}
                            onChange={() => run(() => store.toggleVisible(t.id))}
                          />
                          <span>
                            {t.name}
                            <small>
                              {workspace.projects.find((p) => p.id === t.projectId)?.name}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                </>
              )}
              {narrow && workspace.layout !== 'tabs' && (
                <span className="muted">One active pane at this width</span>
              )}
            </div>
            <div className="tabs" role="tablist" aria-label="Terminals">
              {terminals.map((t, i) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active?.id === t.id}
                  onClick={() => select(t.id)}
                >
                  <i className={`dot ${(states[t.id]?.status ?? 'Stopped').toLowerCase()}`} />
                  <span>{t.name}</span>
                  <small>{i < 9 ? i + 1 : ''}</small>
                </button>
              ))}
            </div>
          </>
        )}
        {terminals.length ? (
          <TerminalLayout
            workspace={workspace}
            states={states}
            controller={controller}
            narrow={narrow}
            maximized={maximized}
            select={select}
            rename={rename}
            close={close}
            start={start}
            maximize={(id) => setMaximized((current) => (current === id ? null : id))}
            hide={(id) =>
              run(() => {
                store.update((w) => ({
                  ...w,
                  visibleTerminalIds: w.visibleTerminalIds.filter((t) => t !== id),
                }));
                setMaximized(null);
              })
            }
            reorder={(id, before) => run(() => store.reorderTerminal(id, before))}
            saveSizes={(sizes) => run(() => store.update((w) => ({ ...w, paneSizes: sizes })))}
            shortcuts={shortcuts}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-visual" aria-hidden="true">
              <span className="empty-orbit orbit-one" />
              <span className="empty-orbit orbit-two" />
              <div className="empty-terminal">
                <Icon name="terminal" size={24} />
              </div>
            </div>
            <span className="eyebrow">PARALLEL AGENTS · LOCAL CONTROL</span>
            <h2>
              {project ? 'Give this project a terminal.' : 'Your terminals. One focused window.'}
            </h2>
            <p>
              Run Codex, Claude Code, Gemini, or any local CLI across the folders already on your
              machine.
            </p>
            <button
              className="primary"
              disabled={!desktopPlatform.available}
              onClick={project ? newTerminal : addProject}
            >
              <Icon name="plus" /> {project ? 'New terminal' : 'Add your first project'}
            </button>
            <div className="empty-capabilities" aria-label="Workspace capabilities">
              <span>Real terminals</span>
              <span>Flexible panes</span>
              <span>Local-first</span>
            </div>
            <div className="empty-hints">
              <span>
                <kbd>Ctrl O</kbd> Add project
              </span>
              <span>
                <kbd>Ctrl N</kbd> New terminal
              </span>
            </div>
          </div>
        )}
      </main>
      <StatusBar
        projects={workspace.projects.length}
        terminals={terminals.length}
        running={terminals.filter((t) => states[t.id]?.status === 'Running').length}
        platform={desktopPlatform}
      />
      <WorkspaceDialogs
        key={`${workspace.id}:${typeof dialog === 'object' ? dialog?.id : dialog}`}
        dialog={dialog}
        setDialog={setDialog}
        workspace={workspace}
        store={store}
        controller={controller}
        platform={desktopPlatform}
        select={select}
        start={start}
        setDrawer={setDrawer}
      />
    </div>
  );
}
