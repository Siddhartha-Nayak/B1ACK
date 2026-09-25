import { useState } from 'react';
import type { Project } from '../../types/workspace';
import type { WorkspacePlatform } from '../../services/platform';
import { Modal } from './Modal';

export function WorktreeCreate({
  project,
  platform,
  close,
  created,
}: {
  project: Project;
  platform: WorkspacePlatform;
  close(): void;
  created(path: string, branch: string): void;
}) {
  const [name, setName] = useState('parallel-task');
  const [branch, setBranch] = useState('codex/parallel-task');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const validName = /^[A-Za-z0-9_-]+$/.test(name);
  return (
    <Modal title="New Git worktree" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!validName || pending) return;
          setPending(true);
          setError('');
          void platform
            .createWorktree(project.path, branch, name)
            .then((path) => {
              try {
                created(path, branch);
              } catch (cause) {
                setError(
                  `Git created ${branch} at ${path}, but ParallelADE could not save it: ${String(cause)}. Use Add project to open that folder.`,
                );
              }
            })
            .catch((cause) => setError(String(cause)))
            .finally(() => setPending(false));
        }}
      >
        <p className="muted">
          Create a separate checkout beside this repository. ParallelADE will add it as a project
          with its own terminal group. The original folder stays unchanged.
        </p>
        <label>
          New branch
          <input
            required
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            placeholder="codex/parallel-task"
          />
        </label>
        <label>
          Directory name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="parallel-task"
          />
        </label>
        <p className="muted">
          Branch must start with <code>codex/</code>. Directory names may contain letters, numbers,
          hyphens, and underscores.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!platform.available || pending || !validName || !branch.startsWith('codex/')}
            type="submit"
          >
            {pending ? 'Creating…' : 'Create worktree'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
