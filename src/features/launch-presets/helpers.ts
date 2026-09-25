import type { Layout, TerminalSession, Workspace } from '../../types/workspace';
import type { LaunchPreset } from '../../types/workspace';

type PresetSource = Pick<Workspace, 'terminals' | 'visibleTerminalIds' | 'layout' | 'gridColumns'>;

/**
 * Snapshot the terminal definitions for one project. Live PTY state is
 * deliberately excluded: presets describe reproducible terminal launches,
 * not running processes or scrollback.
 */
export function captureLaunchPreset(
  source: PresetSource,
  projectId: string,
  name: string,
  id = `launch-${crypto.randomUUID()}`,
): LaunchPreset {
  const terminals = source.terminals
    .filter(
      (terminal) =>
        terminal.projectId === projectId &&
        (source.layout === 'tabs' || source.visibleTerminalIds.includes(terminal.id)),
    )
    .map(({ name: terminalName, presetId, command, args }) => ({
      name: terminalName,
      ...(presetId ? { presetId } : {}),
      command,
      args: [...args],
    }));

  return {
    id,
    projectId,
    name: name.trim(),
    layout: source.layout,
    gridColumns: source.gridColumns,
    terminals,
  };
}

export interface InstantiatedLaunch {
  terminals: TerminalSession[];
  layout: Layout;
  gridColumns: number | null;
  visibleTerminalIds: string[];
  activeTerminalId: string | null;
}

export interface InstantiateOptions {
  /** Existing IDs are checked before creating each new session. */
  existingTerminalIds?: Iterable<string>;
  /** Injectable for deterministic tests and host-specific ID policies. */
  idFactory?: () => string;
  /** Injectable to keep restored definitions deterministic in tests. */
  createdAt?: number;
}

function nextAvailableId(existing: Set<string>, idFactory: () => string): string {
  let id = idFactory();
  while (existing.has(id)) id = idFactory();
  existing.add(id);
  return id;
}

/**
 * Turn a saved preset into fresh stopped terminal definitions. IDs are always
 * regenerated and made unique against the current workspace, so launching a
 * preset never overwrites an existing terminal.
 */
export function instantiateLaunchPreset(
  preset: LaunchPreset,
  projectId: string,
  cwd: string,
  options: InstantiateOptions = {},
): InstantiatedLaunch {
  const existing = new Set(options.existingTerminalIds ?? []);
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const createdAt = options.createdAt ?? Date.now();
  const terminals = preset.terminals.map((definition) => ({
    id: nextAvailableId(existing, idFactory),
    projectId,
    name: definition.name,
    ...(definition.presetId ? { presetId: definition.presetId } : {}),
    cwd,
    command: definition.command,
    args: [...definition.args],
    createdAt,
  }));

  return {
    terminals,
    layout: preset.layout,
    gridColumns: preset.gridColumns,
    visibleTerminalIds: terminals.map((terminal) => terminal.id),
    activeTerminalId: terminals[0]?.id ?? null,
  };
}
