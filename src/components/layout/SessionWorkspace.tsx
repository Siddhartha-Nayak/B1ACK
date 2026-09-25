import { useEffect, useState } from 'react';
import { Icon } from '../ui/Icon';
import { TerminalProviderIcon } from '../terminal/TerminalProviderIcon';
import { TerminalLayout } from '../terminal/TerminalLayout';
import { StatusBar } from '../status/StatusBar';
import { AgentConversation } from '../../features/conversation/AgentConversation';
import { desktopTerminal } from '../../services/terminal/LocalDesktopTerminal';
import { ProjectBrowser } from '../../features/project-browser/ProjectBrowser';
import type {
  Workspace,
  WorkspaceLibrary,
  Project,
  TerminalSession,
  TerminalState,
  PaneSize,
} from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
import type { TerminalController } from '../../services/terminal/TerminalController';
import type { WorkspacePlatform } from '../../services/platform';
import type { Dialog } from './WorkspaceDialogs';
import './session-workspace.css';

interface Props {
  workspace: Workspace;
  library: WorkspaceLibrary;
  store: WorkspaceStore;
  controller: TerminalController;
  states: Record<string, TerminalState>;
  platform: WorkspacePlatform;
  active?: TerminalSession;
  project?: Project;
  narrow: boolean;
  error: string;
  onDismissError(): void;
  onClassic(): void;
  onNewTerminal(): void;
  onAddProject(): void;
  onSelect(id: string): void;
  onStart(terminal: TerminalSession): void;
  onClose(id: string): void;
  onRename(id: string): void;
  onDialog(dialog: Dialog): void;
  shortcuts(event: KeyboardEvent): boolean;
  run(fn: () => void | Promise<void>): void;
}

export function SessionWorkspace({
  workspace,
  library,
  store,
  controller,
  states,
  platform,
  active,
  project,
  narrow,
  error,
  onDismissError,
  onClassic,
  onNewTerminal,
  onAddProject,
  onSelect,
  onStart,
  onClose,
  onRename,
  onDialog,
  shortcuts,
  run,
}: Props) {
  const [sidebarTab, setSidebarTab] = useState<'sessions' | 'files'>('sessions');
  const [surface, setSurface] = useState<'conversation' | 'terminal'>('conversation');
  const [splitSessionId, setSplitSessionId] = useState<string | null>(null);
  const [changesOpen, setChangesOpen] = useState(() => innerWidth > 980);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width: 980px)');
    const hideRail = () => {
      if (media.matches) setChangesOpen(false);
    };
    media.addEventListener('change', hideRail);
    return () => media.removeEventListener('change', hideRail);
  }, []);
  const sessions = project
    ? workspace.terminals.filter((terminal) => terminal.projectId === project.id)
    : workspace.terminals;
  const splitSession = narrow
    ? undefined
    : sessions.find((session) => session.id === splitSessionId && session.id !== active?.id);
  const terminalWorkspace = { ...workspace, layout: 'tabs' as const };
  const storeSizes = (sizes: Record<string, PaneSize>) =>
    run(() => store.update((current) => ({ ...current, paneSizes: sizes })));

  return (
    <div className={`session-shell ${changesOpen ? '' : 'session-changes-closed'}`}>
      <header className="session-titlebar">
        <div className="session-brand" title="ParallelADE">
          <span className="brand-mark" aria-hidden="true" />
          <strong>
            Parallel<span>ADE</span>
          </strong>
        </div>
        <button
          className="session-mobile-menu"
          aria-label="Open navigation"
          onClick={() => setSidebarOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <div className="session-top-tabs" role="tablist" aria-label="Sessions">
          {workspace.terminals.map((terminal) => (
            <button
              key={terminal.id}
              role="tab"
              aria-selected={active?.id === terminal.id}
              onClick={() => onSelect(terminal.id)}
              title={terminal.cwd}
            >
              <TerminalProviderIcon presetId={terminal.presetId} name={terminal.name} />
              <span>{terminal.name}</span>
              <small>
                {workspace.projects.find((item) => item.id === terminal.projectId)?.name}
              </small>
            </button>
          ))}
          <button className="session-add-tab" aria-label="New session" onClick={onNewTerminal}>
            <Icon name="plus" />
          </button>
        </div>
        <div className="session-window-actions">
          <button
            onClick={() => setChangesOpen((current) => !current)}
            aria-pressed={changesOpen}
            title="Toggle changes"
          >
            Changes
          </button>
          <button onClick={onClassic} title="Open the original terminal grid">
            Grid
          </button>
        </div>
      </header>

      {sidebarOpen && (
        <button
          className="session-drawer-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`session-sidebar ${sidebarOpen ? 'session-sidebar-open' : ''}`}>
        <div className="session-sidebar-switch" role="tablist" aria-label="Project navigation">
          <button
            role="tab"
            aria-selected={sidebarTab === 'sessions'}
            onClick={() => setSidebarTab('sessions')}
          >
            Sessions
          </button>
          <button
            role="tab"
            aria-selected={sidebarTab === 'files'}
            onClick={() => setSidebarTab('files')}
          >
            Files
          </button>
        </div>
        <div className="session-side-project">
          <div className="session-side-project-label">PROJECT</div>
          <select
            aria-label="Current project"
            value={project?.id ?? ''}
            onChange={(event) => run(() => store.selectProject(event.target.value))}
          >
            {!project && <option value="">Choose a project</option>}
            {workspace.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span title={project?.path}>{project?.path ?? 'No folder open'}</span>
        </div>
        {sidebarTab === 'sessions' ? (
          <div className="session-session-list">
            <div className="session-list-heading">
              <span>
                SESSIONS <small>{sessions.length}</small>
              </span>
              <button onClick={onNewTerminal} aria-label="New session">
                <Icon name="plus" />
              </button>
            </div>
            {sessions.map((terminal) => (
              <button
                className="session-session-item"
                data-active={active?.id === terminal.id}
                key={terminal.id}
                onClick={() => {
                  onSelect(terminal.id);
                  setSidebarOpen(false);
                }}
              >
                <TerminalProviderIcon presetId={terminal.presetId} name={terminal.name} />
                <span>
                  <strong>{terminal.name}</strong>
                  <small>
                    {states[terminal.id]?.status ?? 'Stopped'} ·{' '}
                    {new Date(terminal.createdAt).toLocaleDateString()}
                  </small>
                </span>
                {states[terminal.id]?.waitingForInput && (
                  <i className="session-attention" title="Needs input" />
                )}
              </button>
            ))}
            {!sessions.length && (
              <p className="session-sidebar-empty">Create a session for this project.</p>
            )}
          </div>
        ) : (
          <div className="session-file-sidebar">
            {project ? (
              <ProjectBrowser
                key={project.id}
                path={project.path}
                platform={platform}
                initialTab="files"
              />
            ) : (
              <p>Open a project first.</p>
            )}
          </div>
        )}
        <div className="session-sidebar-bottom">
          <button onClick={() => onDialog('launch')} disabled={!project}>
            Launch presets
          </button>
          <button onClick={() => onDialog('worktree')} disabled={!project || !platform.available}>
            New worktree
          </button>
          <button onClick={() => onDialog('agents')} disabled={!project}>
            Set up agents
          </button>
          <button onClick={onAddProject}>
            <Icon name="plus" /> Add project
          </button>
          <div className="session-workspace-picker">
            <span>Workspace</span>
            <select
              aria-label="Current workspace"
              value={workspace.id}
              onChange={(event) => run(() => store.switchWorkspace(event.target.value))}
            >
              {library.workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      <main className="session-main">
        <header className="session-pane-header">
          <div>
            <span className="session-pane-grip" aria-hidden="true">
              ⠿
            </span>
            <TerminalProviderIcon presetId={active?.presetId} name={active?.name ?? 'terminal'} />
            <strong>{active?.name ?? project?.name ?? 'New session'}</strong>
            <small>{project?.name ?? 'Workspace'}</small>
          </div>
          <div className="session-pane-actions">
            <button
              aria-pressed={surface === 'conversation'}
              onClick={() => setSurface('conversation')}
            >
              Conversation
            </button>
            <button aria-pressed={surface === 'terminal'} onClick={() => setSurface('terminal')}>
              Terminal
            </button>
            <button
              aria-pressed={!!splitSession}
              onClick={() =>
                setSplitSessionId(
                  splitSession
                    ? null
                    : (sessions.find((session) => session.id !== active?.id)?.id ?? null),
                )
              }
              disabled={narrow || sessions.length < 2}
              title="View two sessions side by side"
            >
              Split
            </button>
            {splitSession && (
              <select
                aria-label="Second session"
                value={splitSession.id}
                onChange={(event) => setSplitSessionId(event.target.value)}
              >
                {sessions
                  .filter((session) => session.id !== active?.id)
                  .map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
              </select>
            )}
            {active && (
              <button aria-label="Rename session" onClick={() => onRename(active.id)}>
                <Icon name="more" />
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="session-notice" role="alert">
            {error}
            <button onClick={onDismissError} aria-label="Dismiss error">
              <Icon name="close" />
            </button>
          </div>
        )}
        {!platform.available && (
          <div className="session-notice">
            Open the desktop app to use local agents and project files.
          </div>
        )}
        {active ? (
          <div className="session-content">
            {surface === 'terminal' ? (
              <TerminalLayout
                workspace={terminalWorkspace}
                states={states}
                controller={controller}
                narrow={narrow}
                maximized={null}
                select={onSelect}
                rename={onRename}
                close={onClose}
                start={onStart}
                maximize={() => {}}
                hide={() => {}}
                reorder={() => {}}
                saveSizes={storeSizes}
                shortcuts={shortcuts}
              />
            ) : (
              <div className={`session-conversation-panes ${splitSession ? 'is-split' : ''}`}>
                <AgentConversation
                  key={active.id}
                  session={active}
                  state={states[active.id] ?? { status: 'Stopped' }}
                  controller={controller}
                  service={desktopTerminal}
                  shortcuts={shortcuts}
                  onStart={onStart}
                />
                {splitSession && (
                  <AgentConversation
                    key={splitSession.id}
                    session={splitSession}
                    state={states[splitSession.id] ?? { status: 'Stopped' }}
                    controller={controller}
                    service={desktopTerminal}
                    shortcuts={shortcuts}
                    onStart={onStart}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="session-empty">
            <span className="brand-mark" aria-hidden="true" />
            <h1>Your coding workspace</h1>
            <p>Open a project and start an agent session.</p>
            <button onClick={project ? onNewTerminal : onAddProject}>
              <Icon name="plus" />
              {project ? 'New session' : 'Add project'}
            </button>
          </div>
        )}
      </main>
      {changesOpen && (
        <aside className="session-changes">
          <div className="session-changes-heading">
            <strong>Changes</strong>
            <button aria-label="Close changes" onClick={() => setChangesOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          {project ? (
            <ProjectBrowser
              key={project.id}
              path={project.path}
              platform={platform}
              initialTab="changes"
            />
          ) : (
            <div className="session-changes-placeholder">Open a project to view changes.</div>
          )}
        </aside>
      )}
      <StatusBar
        projects={workspace.projects.length}
        terminals={workspace.terminals.length}
        running={
          workspace.terminals.filter((terminal) => states[terminal.id]?.status === 'Running').length
        }
        platform={platform}
      />
    </div>
  );
}
