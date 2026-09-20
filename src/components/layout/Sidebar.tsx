import { Icon } from '../ui/Icon';
import { useEffect, useState } from 'react';
import type { Workspace, TerminalState, WorkspaceLibrary } from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
import type { WorkspacePlatform } from '../../services/platform';
import { reorder } from '../../features/workspace/WorkspaceStore';
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
      <nav aria-label="Projects" className="project-list">
        {w.projects.map((project, index) => {
          const terminals = w.terminals.filter((t) => t.projectId === project.id);
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
                  {terminals.map((t) => (
                    <button
                      key={t.id}
                      className={`session-link ${w.activeTerminalId === t.id ? 'active' : ''}`}
                      onClick={() => selectTerminal(t.id)}
                    >
                      <i className={`dot ${(states[t.id]?.status ?? 'Stopped').toLowerCase()}`} />
                      <span className="truncate">{t.name}</span>
                      {!w.visibleTerminalIds.includes(t.id) && (
                        <small title="Hidden from grid">hidden</small>
                      )}
                    </button>
                  ))}
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
