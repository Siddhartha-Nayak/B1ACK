import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProjectFileEntry, ProjectGitChange, ProjectGitStatus, WorkspacePlatform } from '../../services/platform';
import './project-browser.css';

type BrowserTab = 'files' | 'changes';

export function ProjectBrowser({
  path,
  platform,
  initialTab = 'files',
}: {
  path: string;
  platform: WorkspacePlatform;
  initialTab?: BrowserTab;
}) {
  const [tab, setTab] = useState<BrowserTab>(initialTab);
  const [files, setFiles] = useState<ProjectFileEntry[]>([]);
  const [git, setGit] = useState<ProjectGitStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gitError, setGitError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!path || !platform.available) return;
    setBusy(true);
    setError(null);
    try {
      const [fileResult, gitResult] = await Promise.allSettled([
        platform.listProjectFiles(path),
        platform.projectGitStatus(path),
      ]);
      if (fileResult.status === 'fulfilled') setFiles(fileResult.value);
      else setError(fileResult.reason instanceof Error ? fileResult.reason.message : String(fileResult.reason));
      if (gitResult.status === 'fulfilled') {
        setGit(gitResult.value);
        setGitError(null);
      } else {
        setGit(null);
        setGitError(gitResult.reason instanceof Error ? gitResult.reason.message : String(gitResult.reason));
      }
    } finally {
      setBusy(false);
    }
  }, [path, platform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    requestId.current += 1;
    setSelected(null);
    setPreview('');
    return () => { requestId.current += 1; };
  }, [path]);

  const switchTab = (next: BrowserTab) => {
    requestId.current += 1;
    setTab(next);
    setSelected(null);
    setPreview('');
    setError(null);
  };

  const visibleFiles = useMemo(() => {
    const hidden = new Set<string>();
    const result: ProjectFileEntry[] = [];
    for (const entry of files) {
      const parts = entry.path.split('/');
      const parentPaths = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'));
      if (parentPaths.some((parent) => hidden.has(parent))) continue;
      result.push(entry);
      if (entry.kind === 'directory' && collapsed.has(entry.path)) hidden.add(entry.path);
    }
    return result;
  }, [files, collapsed]);

  const showFile = async (relative: string) => {
    const currentRequest = ++requestId.current;
    setSelected(relative);
    setPreview('');
    setError(null);
    setTab('files');
    try {
      const contents = await platform.readProjectFile(path, relative);
      if (currentRequest === requestId.current) setPreview(contents);
    } catch (reason) {
      if (currentRequest === requestId.current) {
        setPreview('');
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
  };

  const showDiff = async (change: ProjectGitChange) => {
    const currentRequest = ++requestId.current;
    setSelected(change.path);
    setPreview('');
    setError(null);
    setTab('changes');
    try {
      const diff = await platform.projectGitDiff(path, change.path);
      if (currentRequest === requestId.current) setPreview(diff);
    } catch (reason) {
      if (currentRequest === requestId.current) {
        setPreview('');
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    }
  };

  const changes = git?.changes ?? [];
  const additions = changes.filter((change) => change.status.includes('A') || change.untracked).length;
  const modifications = changes.filter((change) => !change.untracked && !change.status.includes('A') && !change.status.includes('D')).length;
  const deletions = changes.filter((change) => change.status.includes('D')).length;

  return (
    <section className="project-browser" aria-label="Project files and changes">
      <header className="project-browser__header">
        <div className="project-browser__tabs" role="tablist" aria-label="Project panels">
          <button className={tab === 'files' ? 'is-active' : ''} role="tab" aria-selected={tab === 'files'} onClick={() => switchTab('files')}>
            Files
          </button>
          <button className={tab === 'changes' ? 'is-active' : ''} role="tab" aria-selected={tab === 'changes'} onClick={() => switchTab('changes')}>
            Changes <span>{changes.length}</span>
          </button>
        </div>
        <button className="project-browser__refresh" onClick={() => void refresh()} aria-label="Refresh files and changes" title="Refresh">↻</button>
      </header>

      <div className="project-browser__project" title={path}>
        <span className="project-browser__dot" />
        <span>{path.split(/[\\/]/).filter(Boolean).at(-1) || 'Project'}</span>
      </div>

      {tab === 'changes' && git?.root && (
        <div className="project-browser__branch">
          <span aria-hidden="true">⑂</span>
          <span>{git.branch || 'detached HEAD'}</span>
          <small>{additions ? `+${additions}` : ''}{modifications ? `  ~${modifications}` : ''}{deletions ? `  −${deletions}` : ''}</small>
        </div>
      )}

      {(tab === 'changes' ? gitError : error) && <div className="project-browser__error" role="alert">{tab === 'changes' ? gitError : error}</div>}
      {busy && <div className="project-browser__hint">Refreshing…</div>}

      <div className="project-browser__list">
        {!platform.available && <div className="project-browser__empty">Open this project in the desktop app to browse files and changes.</div>}
        {platform.available && tab === 'files' && visibleFiles.map((entry) => {
          const depth = entry.path.split('/').length - 1;
          const isCollapsed = collapsed.has(entry.path);
          return (
            <button
              key={entry.path}
              className={`project-browser__row ${selected === entry.path ? 'is-selected' : ''}`}
              style={{ paddingLeft: `${12 + depth * 14}px` }}
              onClick={() => entry.kind === 'directory'
                ? setCollapsed((current) => { const next = new Set(current); if (next.has(entry.path)) next.delete(entry.path); else next.add(entry.path); return next; })
                : void showFile(entry.path)}
              title={entry.path}
            >
              <span className="project-browser__file-icon">{entry.kind === 'directory' ? (isCollapsed ? '▸' : '▾') : '·'}</span>
              <span className="project-browser__filename">{entry.name}</span>
              {entry.kind === 'file' && entry.size > 0 && <small>{formatBytes(entry.size)}</small>}
            </button>
          );
        })}

        {platform.available && tab === 'changes' && !gitError && !git?.root && <div className="project-browser__empty">No Git repository found in this folder.</div>}
        {platform.available && tab === 'changes' && git?.root && changes.map((change) => (
          <button key={change.path} className={`project-browser__row ${selected === change.path ? 'is-selected' : ''}`} onClick={() => void showDiff(change)} title={change.path}>
            <span className={`project-browser__change-code ${change.untracked ? 'is-added' : change.status.includes('D') ? 'is-deleted' : 'is-modified'}`}>{change.untracked ? 'U' : change.status.trim() || 'M'}</span>
            <span className="project-browser__filename">{change.path}</span>
          </button>
        ))}

        {platform.available && tab === 'files' && !busy && files.length === 0 && <div className="project-browser__empty">This folder has no visible files.</div>}
        {platform.available && tab === 'changes' && git?.root && changes.length === 0 && <div className="project-browser__empty">Working tree clean.</div>}
      </div>

      {selected && preview && (
        <div className="project-browser__preview">
          <div className="project-browser__preview-title">
            <span>{selected}</span>
            <button onClick={() => { requestId.current += 1; setSelected(null); setPreview(''); }} aria-label="Close preview">×</button>
          </div>
          <pre>{preview}</pre>
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
