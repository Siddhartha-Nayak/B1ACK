import { useState } from 'react';
import { Modal } from './Modal';
import type { WorkspaceLibrary } from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
import type { TerminalController } from '../../services/terminal/TerminalController';
export function WorkspaceManager({
  library,
  store,
  controller,
  close,
}: {
  library: WorkspaceLibrary;
  store: WorkspaceStore;
  controller: TerminalController;
  close(): void;
}) {
  const current = library.workspaces.find((w) => w.id === library.activeWorkspaceId)!;
  const [name, setName] = useState('');
  const [rename, setRename] = useState(current.name);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void | Promise<void>) => {
    try {
      Promise.resolve(fn()).catch((e) => setError(String(e)));
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <Modal title="Manage workspaces" close={close}>
      <p className="muted">
        Each local workspace keeps its own projects and layout. Switching leaves its terminals
        running.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => {
            store.createWorkspace(name);
            close();
          });
        }}
      >
        <label>
          New workspace name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button className="primary">Create workspace</button>
      </form>
      <hr />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => {
            store.renameWorkspace(current.id, rename);
            close();
          });
        }}
      >
        <label>
          Current workspace name
          <input
            required
            maxLength={100}
            value={rename}
            onChange={(e) => setRename(e.target.value)}
          />
        </label>
        <button>Rename workspace</button>
      </form>
      <hr />
      {deleting ? (
        <>
          <p>
            Delete “{current.name}” and terminate its {current.terminals.length} terminals? Project
            files remain on disk.
          </p>
          <footer>
            <button onClick={() => setDeleting(false)}>Cancel</button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setBusy(true);
                  try {
                    for (const t of current.terminals) await controller.close(t.id);
                    store.deleteWorkspace(current.id);
                    close();
                  } finally {
                    setBusy(false);
                  }
                })
              }
            >
              Confirm delete workspace
            </button>
          </footer>
        </>
      ) : (
        <button onClick={() => setDeleting(true)}>Delete current workspace…</button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
