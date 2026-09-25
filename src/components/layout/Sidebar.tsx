import { Icon } from '../ui/Icon';
import { useEffect, useState } from 'react';
import type { Workspace, TerminalState, WorkspaceLibrary } from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
import type { WorkspacePlatform } from '../../services/platform';
import { reorder } from '../../features/workspace/WorkspaceStore';
import { terminalNeedsAttention, terminalAttentionLabel } from './terminalAttention';
export function Sidebar({
  workspace: w,
  library,
  store,
  platform,
  states,
  selectProject,
  selectTerminal,
  add,
  rename,
  remove,
  close,
  run,
}: {
  workspace: Workspace;
  library: WorkspaceLibrary;
  store: WorkspaceStore;
  platform: WorkspacePlatform;
  states: Record<string, TerminalState>;
  selectProject(id: string): void;
  selectTerminal(id: string): void;
  add(): void;
  rename(id: string): void;
  remove(id: string): void;
  close(): void;
  run(fn: () => void | Promise<void>): void;
}) {
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [newFolderProject, setNewFolderProject] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const attention = w.terminals.filter((terminal) => terminalNeedsAttention(states[terminal.id]));
  const activeAttentionIndex = attention.findIndex(
    (terminal) => terminal.id === w.activeTerminalId,
  );
  const nextAttention = attention[(activeAttentionIndex + 1) % attention.length];
  const terminalRow = (t: Workspace['terminals'][number], folders: Workspace['sessionFolders']) => (
    <div className="session-row" key={t.id}>
      <button
        className={`session-link ${w.activeTerminalId === t.id ? 'active' : ''} ${terminalNeedsAttention(states[t.id]) ? 'needs-attention' : ''}`}
        onClick={() => selectTerminal(t.id)}
        title={terminalAttentionLabel(states[t.id]) || t.cwd}
      >
        <i className={`dot ${(states[t.id]?.status ?? 'Stopped').toLowerCase()}`} />
        <span className="truncate">{t.name}</span>
        {terminalNeedsAttention(states[t.id]) && <small className="attention-label">!</small>}
        {!w.visibleTerminalIds.includes(t.id) && <small title="Hidden from grid">hidden</small>}
      </button>
      {folders.length > 0 && (
        <select
          className="session-folder-select"
          aria-label={`Move ${t.name} to session folder`}
          title="Move to session folder"
          value={t.folderId ?? ''}
          onChange={(event) =>
            run(() => store.moveTerminalToFolder(t.id, event.target.value || null))
          }
        >
          <option value="">No folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
  const paths = w.projects.map((p) => `${p.id}:${p.path}`).join('|');
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const entries = await Promise.all(
        w.projects.map(async (p) => {
          try {
            await platform.validateFolder(p.path);
            return [p.id, false] as const;
          } catch {
            return [p.id, true] as const;
          }
        }),
      );
      if (!cancelled) setMissing(Object.fromEntries(entries));
    };
    if (platform.available) void check();
    const focused = () => void check();
    window.addEventListener('focus', focused);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', focused);
    };
  }, [paths, platform]);
  return (
    <>
      <div className="sidebar-heading">
        <span>
          PROJECTS <small>{w.projects.length.toString().padStart(2, '0')}</small>
        </span>
        <button className="drawer-close icon-button" onClick={close} aria-label="Close projects">
          <Icon name="close" />
        </button>
      </div>
      {attention.length > 0 && (
        <button
          className="attention-jump"
          onClick={() => selectTerminal(nextAttention.id)}
          title="Jump to the next terminal needing attention"
        >
          <span>Needs attention</span>
          <small>{attention.length}</small>
        </button>
      )}
      <nav aria-label="Projects" className="project-list">
        {w.projects.map((project, index) => {
          const terminals = w.terminals.filter((t) => t.projectId === project.id);
          const folders = w.sessionFolders.filter((folder) => folder.projectId === project.id);
          return (
            <section className="project-group" key={project.id}>
              <div className={`project-row ${w.activeProjectId === project.id ? 'selected' : ''}`}>
                <button
                  className="collapse-project icon-button"
                  aria-label={`${project.collapsed ? 'Expand' : 'Collapse'} ${project.name}`}
                  aria-expanded={!project.collapsed}
                  onClick={() =>
                    run(() =>
                      store.update((s) => ({
                        ...s,
                        projects: s.projects.map((p) =>
                          p.id === project.id ? { ...p, collapsed: !p.collapsed } : p,
                        ),
                      })),
                    )
                  }
                >
                  <Icon name={project.collapsed ? 'chevronRight' : 'chevronDown'} size={12} />
                </button>
                <button
                  className="project-select"
                  onClick={() => selectProject(project.id)}
                  title={project.path}
                >
                  <span className="truncate">{project.name}</span>
                  {missing[project.id] && (
                    <span className="error" title="Project folder is missing or inaccessible">
                      !
                    </span>
                  )}
                  <small>{terminals.length}</small>
                </button>
                <details className="project-menu">
                  <summary aria-label={`Manage ${project.name}`}>
                    <Icon name="more" size={14} />
                  </summary>
                  <div>
                    <button onClick={() => rename(project.id)}>Rename</button>
                    <button onClick={() => run(() => platform.openFolder(project.path))}>
                      Open folder location
                    </button>
                    <button
                      onClick={(event) => {
                        event.currentTarget.closest('details')?.removeAttribute('open');
                        if (project.collapsed)
                          run(() =>
                            store.update((s) => ({
                              ...s,
                              projects: s.projects.map((p) =>
                                p.id === project.id ? { ...p, collapsed: false } : p,
                              ),
                            })),
                          );
                        setNewFolderProject(project.id);
                        setFolderName('');
                      }}
                    >
                      New session folder
                    </button>
                    <button
                      disabled={index === 0}
                      onClick={() =>
                        run(() =>
                          store.update((s) => ({
                            ...s,
                            projects: reorder(s.projects, project.id, s.projects[index - 1].id),
                          })),
                        )
                      }
                    >
                      Move up
                    </button>
                    <button
                      disabled={index === w.projects.length - 1}
                      onClick={() =>
                        run(() =>
                          store.update((s) => ({
                            ...s,
                            projects: reorder(s.projects, s.projects[index + 1].id, project.id),
                          })),
                        )
                      }
                    >
                      Move down
                    </button>
                    {library.workspaces.length > 1 && (
                      <label className="move-project-label">
                        Move to workspace
                        <select
                          aria-label={`Move ${project.name} to workspace`}
                          value=""
                          onChange={(e) => run(() => store.moveProject(project.id, e.target.value))}
                        >
                          <option value="" disabled>
                            Choose workspace
                          </option>
                          {library.workspaces
                            .filter((ws) => ws.id !== w.id)
                            .map((ws) => (
                              <option key={ws.id} value={ws.id}>
                                {ws.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <button onClick={() => remove(project.id)}>Remove from workspace</button>
                  </div>
                </details>
              </div>
              {missing[project.id] && (
                <span className="missing-folder">Folder missing or inaccessible</span>
              )}
              {!project.collapsed && (
                <div className="project-terminals">
                  {newFolderProject === project.id && (
                    <form
                      className="session-folder-create"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!folderName.trim()) return;
                        run(() =>
                          store.addSessionFolder({
                            id: crypto.randomUUID(),
                            projectId: project.id,
                            name: folderName.trim(),
                          }),
                        );
                        setNewFolderProject(null);
                        setFolderName('');
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Session folder name"
                        maxLength={80}
                        value={folderName}
                        onChange={(event) => setFolderName(event.target.value)}
                        placeholder="Task name"
                      />
                      <button type="submit" disabled={!folderName.trim()}>
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewFolderProject(null)}
                        aria-label="Cancel session folder"
                      >
                        ×
                      </button>
                    </form>
                  )}
                  {folders.map((folder) => (
                    <div className="session-folder" key={folder.id}>
                      <div className="session-folder-heading">
                        <span className="truncate">{folder.name}</span>
                        <small>{terminals.filter((t) => t.folderId === folder.id).length}</small>
                        <button
                          title={`Remove empty grouping ${folder.name}`}
                          aria-label={`Remove session folder ${folder.name}`}
                          onClick={() => run(() => store.removeSessionFolder(folder.id))}
                        >
                          ×
                        </button>
                      </div>
                      {terminals
                        .filter((t) => t.folderId === folder.id)
                        .map((t) => terminalRow(t, folders))}
                    </div>
                  ))}
                  {terminals
                    .filter(
                      (t) => !t.folderId || !folders.some((folder) => folder.id === t.folderId),
                    )
                    .map((t) => terminalRow(t, folders))}
                </div>
              )}
            </section>
          );
        })}
      </nav>
      <button aria-label="Add project" className="add-project" onClick={add}>
        <Icon name="plus" size={14} />
        Add project<kbd>Ctrl O</kbd>
      </button>
      <div className="local-profile" aria-label="Local workspace status">
        <span className="profile-mark">PA</span>
        <span>
          <strong>Local workspace</strong>
          <small>Private by default</small>
        </span>
        <i className="dot running" aria-hidden="true" />
      </div>
      <div className="sidebar-note">
        <p>Independent sessions stay running when you switch projects.</p>
      </div>
    </>
  );
}
