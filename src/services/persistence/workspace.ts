import {
  emptyLibrary,
  emptyWorkspace,
  type Workspace,
  type WorkspaceLibrary,
  type CliPreset,
  type PaneSize,
} from '../../types/workspace';
export const LEGACY_KEY = 'parallelade.workspace.v1';
export const STORAGE_KEY = 'parallelade.library.v2';
export const BACKUP_KEY = `${STORAGE_KEY}.backup`;
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 32768;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const args = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((a) => typeof a === 'string');
function parseOne(v: unknown, legacy = false): Workspace {
  if (
    !record(v) ||
    !Array.isArray(v.projects) ||
    !Array.isArray(v.terminals) ||
    !['tabs', 'grid', 'split'].includes(String(v.layout))
  )
    throw new Error('Unsupported workspace format.');
  if (!legacy && (!text(v.id) || !text(v.name))) throw new Error('Workspace identity is invalid.');
  const projectIds = new Set<string>();
  const projects = v.projects.map((p) => {
    if (
      !record(p) ||
      !text(p.id) ||
      !text(p.name) ||
      !text(p.path) ||
      projectIds.has(p.id) ||
      (p.collapsed !== undefined && typeof p.collapsed !== 'boolean')
    )
      throw new Error('Invalid or duplicate project.');
    projectIds.add(p.id);
    return { id: p.id, name: p.name, path: p.path, collapsed: p.collapsed === true };
  });
  const ids = new Set<string>();
  const terminals = v.terminals.map((t) => {
    if (
      !record(t) ||
      !text(t.id) ||
      ids.has(t.id) ||
      !text(t.projectId) ||
      !projectIds.has(t.projectId) ||
      !text(t.name) ||
      !text(t.cwd) ||
      !text(t.command) ||
      !args(t.args) ||
      !finite(t.createdAt) ||
      (t.presetId !== undefined && !text(t.presetId))
    )
      throw new Error('Invalid or orphaned terminal definition.');
    ids.add(t.id);
    return {
      id: t.id,
      projectId: t.projectId,
      name: t.name,
      cwd: t.cwd,
      command: t.command,
      args: t.args,
      createdAt: t.createdAt,
      presetId: typeof t.presetId === 'string' ? t.presetId : undefined,
    };
  });
  const base = emptyWorkspace(
    legacy ? 'Default' : (v.name as string),
    legacy ? 'migrated-default' : (v.id as string),
  );
  if (
    !legacy &&
    ((v.gridColumns !== null &&
      (!finite(v.gridColumns) || !Number.isInteger(v.gridColumns) || v.gridColumns < 1)) ||
      !finite(v.sidebarWidth) ||
      v.sidebarWidth < 170 ||
      v.sidebarWidth > 480 ||
      typeof v.sidebarCollapsed !== 'boolean' ||
      !Array.isArray(v.visibleTerminalIds) ||
      !v.visibleTerminalIds.every((id) => typeof id === 'string' && ids.has(id)) ||
      !record(v.paneSizes))
  )
    throw new Error('Invalid layout configuration.');
  const paneSizes: Record<string, PaneSize> = {};
  if (!legacy) {
    for (const [id, size] of Object.entries(v.paneSizes as Record<string, unknown>)) {
      if (
        !ids.has(id) ||
        !record(size) ||
        !finite(size.weight) ||
        size.weight <= 0 ||
        (size.height !== undefined &&
          (!finite(size.height) || size.height < 180 || size.height > 10000))
      )
        throw new Error('Invalid pane dimensions.');
      paneSizes[id] = {
        weight: size.weight,
        ...(finite(size.height) ? { height: size.height } : {}),
      };
    }
  }
  const activeTerminal = terminals.find((t) => t.id === v.activeTerminalId);
  const activeProjectId =
    activeTerminal?.projectId ??
    (typeof v.activeProjectId === 'string' && projectIds.has(v.activeProjectId)
      ? v.activeProjectId
      : (projects[0]?.id ?? null));
  return {
    ...base,
    projects,
    terminals,
    layout: v.layout as Workspace['layout'],
    activeProjectId,
    activeTerminalId:
      activeTerminal?.id ?? terminals.find((t) => t.projectId === activeProjectId)?.id ?? null,
    gridColumns: legacy ? null : (v.gridColumns as number | null),
    sidebarWidth: legacy ? 228 : (v.sidebarWidth as number),
    sidebarCollapsed: !legacy && v.sidebarCollapsed === true,
    visibleTerminalIds: legacy
      ? terminals.map((t) => t.id)
      : [...new Set(v.visibleTerminalIds as string[])],
    paneSizes,
  };
}
export function parseWorkspace(raw: string): Workspace {
  const v: unknown = JSON.parse(raw);
  if (!record(v) || v.version !== 1) throw new Error('Unsupported legacy workspace.');
  return parseOne(v, true);
}
export function parseLibrary(raw: string): WorkspaceLibrary {
  const v: unknown = JSON.parse(raw);
  if (
    !record(v) ||
    v.schemaVersion !== 2 ||
    !Array.isArray(v.workspaces) ||
    !v.workspaces.length ||
    !Array.isArray(v.customPresets)
  )
    throw new Error('Unsupported saved library version.');
  const workspaces = v.workspaces.map((w) => parseOne(w));
  const globalIds = new Set<string>();
  for (const w of workspaces)
    for (const id of [w.id, ...w.projects.map((p) => p.id), ...w.terminals.map((t) => t.id)]) {
      if (globalIds.has(id)) throw new Error('Duplicate saved identity.');
      globalIds.add(id);
    }
  const presetIds = new Set<string>();
  const customPresets: CliPreset[] = v.customPresets.map((p) => {
    if (
      !record(p) ||
      !text(p.id) ||
      !p.id.startsWith('custom-') ||
      presetIds.has(p.id) ||
      !text(p.name) ||
      !text(p.command) ||
      !args(p.args) ||
      p.builtIn !== false
    )
      throw new Error('Invalid custom CLI preset.');
    presetIds.add(p.id);
    return {
      id: p.id,
      name: p.name,
      command: p.command,
      args: p.args,
      builtIn: false,
      category: 'Custom',
      icon: '>_',
    };
  });
  return {
    schemaVersion: 2,
    workspaces,
    customPresets,
    activeWorkspaceId: workspaces.some((w) => w.id === v.activeWorkspaceId)
      ? (v.activeWorkspaceId as string)
      : workspaces[0].id,
  };
}
export interface WorkspacePersistence {
  load(): WorkspaceLibrary;
  save(value: WorkspaceLibrary): void;
  warning?: string;
}
export function createPersistence(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): WorkspacePersistence {
  let lastGood: string | null = null;
  const persistence: WorkspacePersistence = {
    load() {
      const raw = storage.getItem(STORAGE_KEY);
      const backup = storage.getItem(BACKUP_KEY);
      if (raw) {
        try {
          const value = parseLibrary(raw);
          lastGood = raw;
          return value;
        } catch (error) {
          if (!backup) throw error;
          const value = parseLibrary(backup);
          lastGood = backup;
          persistence.warning =
            'Recovered the last valid workspace backup. The unreadable primary copy has not been overwritten.';
          return value;
        }
      }
      if (backup) {
        const value = parseLibrary(backup);
        lastGood = backup;
        return value;
      }
      const legacy = storage.getItem(LEGACY_KEY);
      if (legacy) {
        const w = parseWorkspace(legacy);
        const value: WorkspaceLibrary = {
          schemaVersion: 2,
          activeWorkspaceId: w.id,
          workspaces: [w],
          customPresets: [],
        };
        lastGood = JSON.stringify(value);
        return value;
      }
      return emptyLibrary();
    },
    save(value) {
      const next = JSON.stringify(value);
      parseLibrary(next);
      if (lastGood) storage.setItem(BACKUP_KEY, lastGood);
      storage.setItem(STORAGE_KEY, next);
      lastGood = next;
    },
  };
  return persistence;
}
export const localWorkspace = createPersistence({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
});
