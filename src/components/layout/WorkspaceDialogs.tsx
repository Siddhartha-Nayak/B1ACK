import { useState } from 'react';
import { Modal } from './Modal';
import { AgentSetup } from './AgentSetup';
import { NewTerminal } from '../terminal/NewTerminal';
import { WorkspaceManager } from './WorkspaceManager';
import { WorkspaceSearch } from './WorkspaceSearch';
import type { Workspace, TerminalSession } from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
import type { TerminalController } from '../../services/terminal/TerminalController';
import type { WorkspacePlatform } from '../../services/platform';
export type Dialog =
  | 'project'
  | 'agents'
  | 'terminal'
  | 'search'
  | 'workspaces'
  | { kind: 'rename'; id: string; target: 'project' | 'terminal' }
  | { kind: 'remove'; id: string }
  | null;

interface Props {
  dialog: Dialog;
  setDialog(dialog: Dialog): void;
  workspace: Workspace;
  store: WorkspaceStore;
  controller: TerminalController;
  platform: WorkspacePlatform;
  select(id: string): void;
  start(session: TerminalSession): void;
  setDrawer(value: boolean): void;
}
export function WorkspaceDialogs({
  dialog,
  setDialog,
  workspace,
  store,
  controller,
  platform,
  select,
  start,
  setDrawer,
}: Props) {
  const [value, setValue] = useState(() =>
    typeof dialog === 'object' && dialog?.kind === 'rename'
      ? ((dialog.target === 'project' ? workspace.projects : workspace.terminals).find(
          (item) => item.id === dialog.id,
        )?.name ?? '')
      : '',
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const project = workspace.projects.find((p) => p.id === workspace.activeProjectId);
  const terminals = workspace.terminals.filter((t) => t.projectId === project?.id);
  const run = (fn: () => void | Promise<void>) => {
    try {
      Promise.resolve(fn()).catch((e) => setError(String(e)));
    } catch (e) {
      setError(String(e));
    }
  };
  const addFolder = async (path: string) => {
    setPending(true);
    try {
      const valid = await platform.validateFolder(path);
      const existing = workspace.projects.find((p) => p.path.toLowerCase() === valid.toLowerCase());
      if (existing) store.selectProject(existing.id);
      else {
        const id = crypto.randomUUID();
        store.update((s) => ({
          ...s,
          projects: [
            ...s.projects,
            { id, name: valid.split(/[\\/]/).filter(Boolean).pop() || valid, path: valid },
          ],
          activeProjectId: id,
          activeTerminalId: null,
        }));
      }
      setDialog('agents');
      setDrawer(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {' '}
      {dialog === 'project' && (
        <Modal title="Add project" close={() => setDialog(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addFolder(value));
            }}
          >
            <p className="muted">A project is a local folder. Add as many terminals as you need.</p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <label>
              Project folder
              <input
                autoFocus
                required
                aria-label="Project folder"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter a folder path"
              />
            </label>
            <button
              type="button"
              disabled={pending || !platform.available}
              onClick={() =>
                run(async () => {
                  const path = await platform.pickFolder();
                  if (path) setValue(path);
                })
              }
            >
              Browse folders…
            </button>
            <footer>
              <button type="button" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="primary" disabled={pending || !platform.available} type="submit">
                {pending ? 'Checking…' : 'Add project'}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {dialog === 'agents' && <AgentSetup platform={platform} close={() => setDialog(null)} />}
      {dialog === 'terminal' && project && (
        <NewTerminal
          platform={platform}
          customPresets={store.getSnapshot().customPresets}
          savePreset={(p) => store.savePreset(p)}
          deletePreset={(id) => store.deletePreset(id)}
          project={project}
          count={terminals.length}
          close={() => setDialog(null)}
          create={(t) => {
            store.addTerminal(t);
            setDialog(null);
            start(t);
          }}
        />
      )}
      {typeof dialog === 'object' && dialog?.kind === 'rename' && (
        <Modal title={`Rename ${dialog.target}`} close={() => setDialog(null)}>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => {
                store.update((s) =>
                  dialog.target === 'project'
                    ? {
                        ...s,
                        projects: s.projects.map((p) =>
                          p.id === dialog.id ? { ...p, name: value.trim() } : p,
                        ),
                      }
                    : {
                        ...s,
                        terminals: s.terminals.map((t) =>
                          t.id === dialog.id ? { ...t, name: value.trim() } : t,
                        ),
                      },
                );
                setDialog(null);
              });
            }}
          >
            <label>
              Name
              <input
                autoFocus
                required
                maxLength={100}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <footer>
              <button className="primary" disabled={!value.trim()}>
                Save name
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {typeof dialog === 'object' && dialog?.kind === 'remove' && (
        <Modal title="Remove project" close={() => setDialog(null)}>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <p>
            Remove this project from the workspace and terminate its terminals? Files in the folder
            will remain on disk.
          </p>
          <footer>
            <button onClick={() => setDialog(null)}>Cancel</button>
            <button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  setPending(true);
                  try {
                    for (const t of workspace.terminals.filter((t) => t.projectId === dialog.id))
                      await controller.close(t.id);
                    store.update((s) => {
                      const projects = s.projects.filter((p) => p.id !== dialog.id);
                      return {
                        ...s,
                        projects,
                        terminals: s.terminals.filter((t) => t.projectId !== dialog.id),
                        activeProjectId:
                          s.activeProjectId === dialog.id
                            ? (projects[0]?.id ?? null)
                            : s.activeProjectId,
                        activeTerminalId: null,
                      };
                    });
                    setDialog(null);
                  } finally {
                    setPending(false);
                  }
                })
              }
            >
              Remove project
            </button>
          </footer>
        </Modal>
      )}
      {dialog === 'search' && (
        <WorkspaceSearch
          library={store.getSnapshot()}
          store={store}
          select={select}
          close={() => {
            setDialog(null);
            setDrawer(false);
          }}
        />
      )}
      {dialog === 'workspaces' && (
        <WorkspaceManager
          library={store.getSnapshot()}
          store={store}
          controller={controller}
          close={() => setDialog(null)}
        />
      )}{' '}
    </>
  );
}
