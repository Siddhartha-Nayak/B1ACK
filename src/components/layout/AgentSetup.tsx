import { useEffect, useState } from 'react';
import type { WorkspacePlatform } from '../../services/platform';
import { Icon } from '../ui/Icon';
import { Modal } from './Modal';

export type AgentTool = {
  name: string;
  command: string;
  tone: 'clay' | 'paper' | 'mist' | 'star' | 'terminal';
  note?: string;
  installable?: boolean;
};

export const agentTools: AgentTool[] = [
  { name: 'Claude Code', command: 'claude', tone: 'clay', installable: true },
  { name: 'Codex', command: 'codex', tone: 'paper', installable: true },
  { name: 'Cursor Agent', command: 'cursor-agent', tone: 'mist', note: 'WSL setup' },
  { name: 'Gemini CLI', command: 'gemini', tone: 'star', installable: true },
  { name: 'GitHub Copilot', command: 'copilot', tone: 'paper', installable: true },
  { name: 'Grok Build', command: 'grok', tone: 'paper', note: 'Manual setup' },
  { name: 'Terminal', command: '', tone: 'terminal', note: 'Ready' },
];

const detectableCommands = agentTools.filter((tool) => tool.command).map((tool) => tool.command);

export function AgentSetup({
  platform,
  close,
  projectPath,
}: {
  platform: WorkspacePlatform;
  close(): void;
  /** Folder that triggered the readiness check, when opened from a project flow. */
  projectPath?: string;
}) {
  const [detected, setDetected] = useState<Record<string, string | null>>({});
  const [checking, setChecking] = useState(platform.available);
  const [checked, setChecked] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const missingCount = agentTools.filter(
    (tool) => tool.command && tool.installable && detected[tool.command] === null,
  ).length;
  const readyCount = agentTools.filter(
    (tool) => !tool.command || Boolean(detected[tool.command]),
  ).length;

  const refresh = async () => {
    if (!platform.available) return;
    setChecking(true);
    setChecked(false);
    setError('');
    try {
      setDetected(await platform.detectCommands(detectableCommands));
      setChecked(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const install = async () => {
    setInstalling(true);
    setError('');
    setMessage('');
    try {
      const result = await platform.installAllAgents();
      setMessage(result.output);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Modal title="Agent readiness" close={close}>
      <section className="agent-setup">
        <p className="muted">
          {projectPath ? (
            <>
              Check which coding agents are ready for <strong>{projectPath}</strong> before opening
              a terminal.
            </>
          ) : (
            'Check which coding agents are ready before opening a terminal.'
          )}
        </p>
        <p className="agent-readiness-summary" aria-live="polite">
          {checking
            ? 'Checking your PATH…'
            : !checked
              ? 'Could not determine agent readiness. Retry the check.'
              : `${readyCount} of ${agentTools.length} tools ready${missingCount ? ` · ${missingCount} can be installed` : ''}`}
        </p>
        <div className="agent-tool-grid" aria-label="Available coding tools">
          {agentTools.map((tool) => {
            const installed = tool.command ? Boolean(detected[tool.command]) : true;
            const state = checking
              ? 'Checking…'
              : !checked
                ? 'Unknown'
                : installed
                  ? 'Installed'
                  : tool.note || 'Not installed';
            return (
              <article className="agent-tool" key={tool.name}>
                <span className={`agent-tool-mark ${tool.tone}`} aria-hidden="true">
                  {tool.tone === 'terminal' ? <Icon name="terminal" size={15} /> : '✦'}
                </span>
                <span className="agent-tool-copy">
                  <strong>{tool.name}</strong>
                  <small className={installed ? 'ready' : ''}>{state}</small>
                </span>
              </article>
            );
          })}
        </div>
        <p className="agent-setup-note">
          Readiness only checks your local PATH. Nothing is installed automatically. Install all
          adds Codex, Claude Code, Gemini CLI, and GitHub Copilot with npm. Cursor Agent runs
          through WSL; Grok Build has no official native CLI installer to run here.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <pre className="agent-install-output">{message}</pre>}
        <footer>
          <button type="button" onClick={() => void refresh()} disabled={checking || installing}>
            {checking ? 'Checking…' : 'Refresh status'}
          </button>
          <button type="button" onClick={close}>
            Not now
          </button>
          <button
            className="primary"
            type="button"
            disabled={
              !platform.available || installing || checking || !checked || missingCount === 0
            }
            onClick={() => void install()}
          >
            <Icon name="sparkles" />{' '}
            {installing
              ? 'Installing agents…'
              : !checked
                ? 'Check readiness first'
                : missingCount === 0
                  ? 'All agents ready'
                  : 'Install all agents'}
          </button>
        </footer>
      </section>
    </Modal>
  );
}
