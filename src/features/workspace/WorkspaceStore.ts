import {
  emptyLibrary,
  emptyWorkspace,
  type Workspace,
  type WorkspaceLibrary,
  type TerminalSession,
  type CliPreset,
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
