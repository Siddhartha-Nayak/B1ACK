import {
  emptyLibrary,
  emptyWorkspace,
  type Workspace,
  type WorkspaceLibrary,
  type TerminalSession,
  type CliPreset,
  type SessionFolder,
  type LaunchPreset,
} from '../../types/workspace';
import type { WorkspacePersistence } from '../../services/persistence/workspace';
export function reorder<T extends { id: string }>(items: T[], id: string, before: string): T[] {
  const source = items.find((item) => item.id === id);
  if (!source || id === before || !items.some((item) => item.id === before)) return items;
  const next = items.filter((item) => item.id !== id);
  next.splice(
    next.findIndex((item) => item.id === before),
    0,
    source,
  );
  return next;
}
function repair(w: Workspace): Workspace {
  const ids = new Set(w.terminals.map((t) => t.id));
  const projectIds = new Set(w.projects.map((p) => p.id));
  const projectId = w.projects.some((p) => p.id === w.activeProjectId)
    ? w.activeProjectId
    : (w.projects[0]?.id ?? null);
  return {
    ...w,
    activeProjectId: projectId,
    activeTerminalId: ids.has(w.activeTerminalId ?? '')
      ? w.activeTerminalId
      : (w.terminals.find((t) => t.projectId === projectId)?.id ?? null),
    visibleTerminalIds: w.visibleTerminalIds.filter((id) => ids.has(id)),
    paneSizes: Object.fromEntries(Object.entries(w.paneSizes).filter(([id]) => ids.has(id))),
    sessionFolders: w.sessionFolders.filter((folder) => projectIds.has(folder.projectId)),
    launchPresets: w.launchPresets.filter((preset) => projectIds.has(preset.projectId)),
  };
}
export class WorkspaceStore {
  private state: WorkspaceLibrary;
  private listeners = new Set<() => void>();
  error = '';
  warning = '';
  constructor(private persistence: WorkspacePersistence) {
    try {
      this.state = persistence.load();
      this.warning = persistence.warning ?? '';
    } catch (e) {
      this.state = emptyLibrary();
      this.error = `Workspace could not be restored: ${String(e)}. Saved data has not been overwritten.`;
    }
  }
  getSnapshot = () => this.state;
  current = () => this.state.workspaces.find((w) => w.id === this.state.activeWorkspaceId)!;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private commit(next: WorkspaceLibrary) {
    if (this.error) throw new Error(this.error);
    this.persistence.save(next);
    this.state = next;
    this.listeners.forEach((l) => l());
  }
  update(fn: (state: Workspace) => Workspace) {
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) =>
        w.id === this.state.activeWorkspaceId ? repair(fn(w)) : w,
      ),
    });
  }
  reset() {
    const next = emptyLibrary();
    this.persistence.save(next);
    this.state = next;
    this.error = '';
    this.listeners.forEach((l) => l());
  }
  createWorkspace(name: string) {
    if (!name.trim()) throw new Error('Enter a workspace name.');
    const w = emptyWorkspace(name.trim());
    this.commit({
      ...this.state,
      workspaces: [...this.state.workspaces, w],
      activeWorkspaceId: w.id,
    });
  }
  renameWorkspace(id: string, name: string) {
    if (!name.trim()) throw new Error('Enter a workspace name.');
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) => (w.id === id ? { ...w, name: name.trim() } : w)),
    });
  }
  switchWorkspace(id: string) {
    if (this.state.workspaces.some((w) => w.id === id))
      this.commit({ ...this.state, activeWorkspaceId: id });
  }
  deleteWorkspace(id: string) {
    let workspaces = this.state.workspaces.filter((w) => w.id !== id);
    if (!workspaces.length) workspaces = [emptyWorkspace()];
    this.commit({
      ...this.state,
      workspaces,
      activeWorkspaceId:
        this.state.activeWorkspaceId === id ? workspaces[0].id : this.state.activeWorkspaceId,
    });
  }
  selectProject(id: string) {
    const owner = this.state.workspaces.find((w) => w.projects.some((p) => p.id === id));
    if (!owner) return;
    const terminal = owner.terminals.find((t) => t.projectId === id);
    this.commit({
      ...this.state,
      activeWorkspaceId: owner.id,
      workspaces: this.state.workspaces.map((w) =>
        w.id === owner.id
          ? { ...w, activeProjectId: id, activeTerminalId: terminal?.id ?? null }
          : w,
      ),
    });
  }
  selectTerminal(id: string) {
    const owner = this.state.workspaces.find((w) => w.terminals.some((t) => t.id === id));
    const t = owner?.terminals.find((t) => t.id === id);
    if (!owner || !t) return;
    this.commit({
      ...this.state,
      activeWorkspaceId: owner.id,
      workspaces: this.state.workspaces.map((w) =>
        w.id === owner.id
          ? {
              ...w,
              activeProjectId: t.projectId,
              activeTerminalId: id,
              visibleTerminalIds: w.visibleTerminalIds.includes(id)
                ? w.visibleTerminalIds
                : [...w.visibleTerminalIds, id],
            }
          : w,
      ),
    });
  }
  addTerminal(t: TerminalSession) {
    const owner = this.state.workspaces.find((w) => w.projects.some((p) => p.id === t.projectId));
    if (!owner) throw new Error('The project was removed before the terminal could start.');
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) =>
        w.id === owner.id
          ? {
              ...w,
              terminals: [...w.terminals, t],
              visibleTerminalIds: [...w.visibleTerminalIds, t.id],
              activeProjectId: t.projectId,
              activeTerminalId: t.id,
            }
          : w,
      ),
    });
  }
  addTerminals(
    projectId: string,
    sessions: TerminalSession[],
    layout?: Workspace['layout'],
    gridColumns?: number | null,
  ) {
    if (!sessions.length) return;
    const owner = this.state.workspaces.find((w) => w.projects.some((p) => p.id === projectId));
    if (!owner || sessions.some((t) => t.projectId !== projectId))
      throw new Error('The launch preset project is unavailable.');
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) =>
        w.id === owner.id
          ? repair({
              ...w,
              terminals: [...w.terminals, ...sessions],
              visibleTerminalIds: [...w.visibleTerminalIds, ...sessions.map((t) => t.id)],
              activeProjectId: projectId,
              activeTerminalId: sessions[0].id,
              ...(layout ? { layout } : {}),
              ...(gridColumns !== undefined ? { gridColumns } : {}),
            })
          : w,
      ),
    });
  }
  saveLaunchPreset(preset: LaunchPreset) {
    this.update((w) => {
      if (!w.projects.some((p) => p.id === preset.projectId)) throw new Error('Project not found.');
      return {
        ...w,
        launchPresets: [...w.launchPresets.filter((p) => p.id !== preset.id), preset],
      };
    });
  }
  deleteLaunchPreset(id: string) {
    this.update((w) => ({ ...w, launchPresets: w.launchPresets.filter((p) => p.id !== id) }));
  }
  addSessionFolder(folder: SessionFolder) {
    this.update((w) => {
      if (!w.projects.some((p) => p.id === folder.projectId)) throw new Error('Project not found.');
      return { ...w, sessionFolders: [...w.sessionFolders, folder] };
    });
  }
  renameSessionFolder(id: string, name: string) {
    if (!name.trim()) throw new Error('Enter a folder name.');
    this.update((w) => ({
      ...w,
      sessionFolders: w.sessionFolders.map((folder) =>
        folder.id === id ? { ...folder, name: name.trim() } : folder,
      ),
    }));
  }
  removeSessionFolder(id: string) {
    this.update((w) => ({
      ...w,
      sessionFolders: w.sessionFolders.filter((folder) => folder.id !== id),
      terminals: w.terminals.map((t) => (t.folderId === id ? { ...t, folderId: undefined } : t)),
    }));
  }
  moveTerminalToFolder(id: string, folderId: string | null) {
    this.update((w) => {
      const terminal = w.terminals.find((t) => t.id === id);
      if (!terminal) return w;
      if (
        folderId &&
        !w.sessionFolders.some((f) => f.id === folderId && f.projectId === terminal.projectId)
      )
        throw new Error('Session folder not found in this project.');
      return {
        ...w,
        terminals: w.terminals.map((t) =>
          t.id === id ? { ...t, folderId: folderId ?? undefined } : t,
        ),
      };
    });
  }
  removeTerminal(id: string) {
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) =>
        repair({
          ...w,
          terminals: w.terminals.filter((t) => t.id !== id),
          activeTerminalId: w.activeTerminalId === id ? null : w.activeTerminalId,
        }),
      ),
    });
  }
  reorderTerminal(id: string, before: string) {
    this.update((w) => ({ ...w, terminals: reorder(w.terminals, id, before) }));
  }
  toggleVisible(id: string) {
    this.update((w) => ({
      ...w,
      visibleTerminalIds: w.visibleTerminalIds.includes(id)
        ? w.visibleTerminalIds.filter((t) => t !== id)
        : [...w.visibleTerminalIds, id],
    }));
  }
  moveProject(id: string, targetId: string) {
    const source = this.current();
    const target = this.state.workspaces.find((w) => w.id === targetId);
    const project = source.projects.find((p) => p.id === id);
    if (!project || !target || source.id === targetId) return;
    const terminals = source.terminals.filter((t) => t.projectId === id);
    const sessionFolders = source.sessionFolders.filter((folder) => folder.projectId === id);
    const launchPresets = source.launchPresets.filter((preset) => preset.projectId === id);
    const ids = new Set(terminals.map((t) => t.id));
    this.commit({
      ...this.state,
      workspaces: this.state.workspaces.map((w) =>
        w.id === source.id
          ? repair({
              ...w,
              projects: w.projects.filter((p) => p.id !== id),
              terminals: w.terminals.filter((t) => !ids.has(t.id)),
            })
          : w.id === targetId
            ? {
                ...w,
                projects: [...w.projects, project],
                sessionFolders: [...w.sessionFolders, ...sessionFolders],
                launchPresets: [...w.launchPresets, ...launchPresets],
                terminals: [...w.terminals, ...terminals],
                visibleTerminalIds: [...w.visibleTerminalIds, ...terminals.map((t) => t.id)],
                paneSizes: {
                  ...w.paneSizes,
                  ...Object.fromEntries(
                    Object.entries(source.paneSizes).filter(([id]) => ids.has(id)),
                  ),
                },
              }
            : w,
      ),
    });
  }
  savePreset(p: CliPreset) {
    if (p.builtIn || !p.id.startsWith('custom-'))
      throw new Error('Built-in presets cannot be overwritten.');
    this.commit({
      ...this.state,
      customPresets: [...this.state.customPresets.filter((item) => item.id !== p.id), p],
    });
  }
  deletePreset(id: string) {
    this.commit({
      ...this.state,
      customPresets: this.state.customPresets.filter((p) => p.id !== id),
    });
  }
}
