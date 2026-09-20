import { useState } from 'react';
import { Modal } from './Modal';
import type { WorkspaceLibrary } from '../../types/workspace';
import type { WorkspaceStore } from '../../features/workspace/WorkspaceStore';
export function WorkspaceSearch({
  library,
  store,
  select,
  close,
}: {
  library: WorkspaceLibrary;
  store: WorkspaceStore;
  select(id: string): void;
  close(): void;
}) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const tokens = query.toLowerCase().trim().split(/\s+/);
  const match = (text: string) => tokens.every((t) => text.toLowerCase().includes(t));
  const results = library.workspaces
    .flatMap((w) => [
      { id: w.id, name: w.name, context: 'Workspace', kind: 'workspace' as const, search: w.name },
      ...w.projects.map((p) => ({
        id: p.id,
        name: p.name,
        context: w.name,
        kind: 'project' as const,
        search: `${w.name} ${p.name} ${p.path}`,
      })),
      ...w.terminals.map((t) => ({
        id: t.id,
        name: t.name,
        context: `${w.name} / ${w.projects.find((p) => p.id === t.projectId)?.name ?? ''}`,
        kind: 'terminal' as const,
        search: `${w.name} ${w.projects.find((p) => p.id === t.projectId)?.name ?? ''} ${t.name} ${t.command}`,
      })),
    ])
    .filter((r) => match(r.search));
  return (
    <Modal title="Find a workspace, project or terminal" close={close}>
      <input
        autoFocus
        aria-label="Search workspace"
        placeholder="Workspace, project, terminal or CLI…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>('.search-results button')?.click();
          }
        }}
      />
      <div className="search-results">
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              try {
                if (r.kind === 'terminal') select(r.id);
                else if (r.kind === 'project') store.selectProject(r.id);
                else store.switchWorkspace(r.id);
                close();
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            <span>
              {r.kind === 'terminal' ? '›_' : r.kind === 'project' ? '▱' : '▦'} {r.name}
            </span>
            <small>{r.context}</small>
          </button>
        ))}
        {!results.length && <p className="muted">No matches.</p>}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="muted shortcut-note">
        Inside a terminal, use Ctrl+Shift+K. Ctrl+Tab / Ctrl+Shift+Tab switch sessions.
      </p>
    </Modal>
  );
}
