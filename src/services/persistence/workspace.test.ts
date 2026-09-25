import { describe, it, expect } from 'vitest';
import {
  parseWorkspace,
  parseLibrary,
  createPersistence,
  STORAGE_KEY,
  BACKUP_KEY,
  LEGACY_KEY,
} from './workspace';
import { emptyLibrary, emptyWorkspace } from '../../types/workspace';
import { WorkspaceStore, reorder } from '../../features/workspace/WorkspaceStore';
const legacy = {
  version: 1,
  projects: [{ id: 'p', name: 'Project', path: 'C:\\P' }],
  terminals: [
    {
      id: 't',
      projectId: 'p',
      name: 'Codex',
      cwd: 'C:\\P',
      command: 'codex',
      args: [],
      createdAt: 1,
    },
  ],
  layout: 'grid',
  activeProjectId: 'p',
  activeTerminalId: 't',
};
function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}
describe('versioned workspace library', () => {
  it('migrates legacy configuration without deleting its original copy', () => {
    const storage = memory();
    storage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const p = createPersistence(storage);
    const value = p.load();
    expect(value.workspaces[0].terminals[0].id).toBe('t');
    expect(value.workspaces[0].visibleTerminalIds).toEqual(['t']);
    p.save(value);
    expect(storage.getItem(LEGACY_KEY)).toBe(JSON.stringify(legacy));
    expect(parseLibrary(storage.getItem(STORAGE_KEY)!).schemaVersion).toBe(2);
  });
  it('rejects invalid, duplicate and orphaned records', () => {
    expect(() => parseWorkspace('{')).toThrow();
    expect(() => parseLibrary(JSON.stringify({ schemaVersion: 99 }))).toThrow();
    expect(() =>
      parseWorkspace(
        JSON.stringify({ ...legacy, projects: [legacy.projects[0], legacy.projects[0]] }),
      ),
    ).toThrow();
    expect(() => parseWorkspace(JSON.stringify({ ...legacy, projects: [] }))).toThrow();
  });
  it('recovers a valid backup and refuses to overwrite corrupt data without one', () => {
    const storage = memory();
    const p = createPersistence(storage);
    const initial = p.load();
    p.save(initial);
    p.save({ ...initial, workspaces: [{ ...initial.workspaces[0], name: 'Changed' }] });
    storage.setItem(STORAGE_KEY, 'broken');
    const recovered = createPersistence(storage);
    expect(recovered.load().workspaces[0].name).toBe('Default');
    expect(recovered.warning).toContain('Recovered');
    expect(storage.getItem(STORAGE_KEY)).toBe('broken');
    storage.map.delete(BACKUP_KEY);
    const store = new WorkspaceStore(createPersistence(storage));
    expect(() => store.update((w) => w)).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe('broken');
  });
  it('does not update state when a save fails', () => {
    const store = new WorkspaceStore({
      load: emptyLibrary,
      save() {
        throw new Error('quota');
      },
    });
    expect(() => store.update((w) => ({ ...w, layout: 'grid' }))).toThrow();
    expect(store.current().layout).toBe('tabs');
  });
  it('keeps independent layout, custom presets, visibility and selection across switches', () => {
    const storage = memory();
    const store = new WorkspaceStore(createPersistence(storage));
    const first = store.current().id;
    store.update((w) => ({
      ...w,
      projects: [legacy.projects[0]],
      terminals: legacy.terminals,
      visibleTerminalIds: ['t'],
      paneSizes: { t: { weight: 2, height: 400 } },
      layout: 'grid',
    }));
    store.createWorkspace('Personal');
    const second = store.current().id;
    store.update((w) => ({ ...w, layout: 'split' }));
    store.savePreset({
      id: 'custom-test',
      name: 'Test',
      command: 'tool',
      args: ['a b'],
      category: 'Custom',
      icon: '>_',
      builtIn: false,
    });
    store.switchWorkspace(first);
    expect(store.current().paneSizes.t.height).toBe(400);
    expect(store.current().layout).toBe('grid');
    const reopened = new WorkspaceStore(createPersistence(storage));
    expect(reopened.current().id).toBe(first);
    expect(reopened.getSnapshot().customPresets[0].args).toEqual(['a b']);
    reopened.switchWorkspace(second);
    expect(reopened.current().layout).toBe('split');
  });
  it('reorders terminals and moves projects without changing terminal definitions', () => {
    expect(reorder([{ id: '1' }, { id: '2' }, { id: '9' }], '9', '2').map((x) => x.id)).toEqual([
      '1',
      '9',
      '2',
    ]);
    const store = new WorkspaceStore({ load: emptyLibrary, save() {} });
    store.update((w) => ({
      ...w,
      projects: legacy.projects,
      terminals: legacy.terminals,
      visibleTerminalIds: ['t'],
    }));
    const source = store.current().id;
    store.createWorkspace('Destination');
    const dest = store.current().id;
    store.switchWorkspace(source);
    store.moveProject('p', dest);
    expect(store.current().terminals).toHaveLength(0);
    store.switchWorkspace(dest);
    expect(store.current().terminals[0]).toEqual(legacy.terminals[0]);
  });
  it('validates persisted sizes instead of accepting zero or nonfinite dimensions', () => {
    const data = emptyLibrary();
    data.workspaces[0] = {
      ...emptyWorkspace('X', data.activeWorkspaceId),
      projects: legacy.projects,
      terminals: legacy.terminals,
      visibleTerminalIds: ['t'],
      paneSizes: { t: { weight: 0 } },
    };
    expect(() => parseLibrary(JSON.stringify(data))).toThrow();
  });
  it('routes asynchronous terminal changes to their owner after a workspace switch', () => {
    const store = new WorkspaceStore({ load: emptyLibrary, save() {} });
    store.update((w) => ({ ...w, projects: legacy.projects }));
    const owner = store.current().id;
    store.createWorkspace('Other');
    const active = store.current().id;
    store.addTerminal(legacy.terminals[0]);
    expect(store.current().id).toBe(active);
    expect(store.current().terminals).toHaveLength(0);
    expect(store.getSnapshot().workspaces.find((w) => w.id === owner)?.terminals).toHaveLength(1);
    store.removeTerminal('t');
    expect(store.getSnapshot().workspaces.find((w) => w.id === owner)?.terminals).toHaveLength(0);
  });
  it('persists launch presets and task folders and validates their references', () => {
    const storage = memory();
    const store = new WorkspaceStore(createPersistence(storage));
    store.update((w) => ({ ...w, projects: legacy.projects }));
    store.addSessionFolder({ id: 'folder', projectId: 'p', name: 'Review' });
    store.addTerminal({ ...legacy.terminals[0], folderId: 'folder' });
    store.saveLaunchPreset({
      id: 'launch',
      projectId: 'p',
      name: 'Codex and tests',
      layout: 'grid',
      gridColumns: 2,
      terminals: [{ name: 'Codex', command: 'codex', args: [] }],
    });
    const loaded = createPersistence(storage).load().workspaces[0];
    expect(loaded.sessionFolders[0].name).toBe('Review');
    expect(loaded.terminals[0].folderId).toBe('folder');
    expect(loaded.launchPresets[0].gridColumns).toBe(2);
    const invalid = { ...loaded, sessionFolders: [] };
    expect(() =>
      parseLibrary(JSON.stringify({ ...store.getSnapshot(), workspaces: [invalid] })),
    ).toThrow();
  });
  it('moves task folders and launch presets with their project', () => {
    const store = new WorkspaceStore({ load: emptyLibrary, save() {} });
    store.update((w) => ({ ...w, projects: legacy.projects }));
    store.addSessionFolder({ id: 'folder', projectId: 'p', name: 'Feature' });
    store.saveLaunchPreset({
      id: 'launch',
      projectId: 'p',
      name: 'Start',
      layout: 'tabs',
      gridColumns: null,
      terminals: [{ name: 'Shell', command: 'cmd.exe', args: [] }],
    });
    const source = store.current().id;
    store.createWorkspace('Other');
    const destination = store.current().id;
    store.switchWorkspace(source);
    store.moveProject('p', destination);
    store.switchWorkspace(destination);
    expect(store.current().sessionFolders.map((f) => f.id)).toEqual(['folder']);
    expect(store.current().launchPresets.map((p) => p.id)).toEqual(['launch']);
  });
});
