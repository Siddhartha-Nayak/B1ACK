import { useEffect, useState } from 'react';
import type { WorkspacePlatform } from '../../services/platform';
import { Icon } from '../ui/Icon';
import { Modal } from './Modal';

type AgentTool = {
  name: string;
  command: string;
  tone: 'clay' | 'paper' | 'mist' | 'star' | 'terminal';
  note?: string;
  installable?: boolean;
};

const agentTools: AgentTool[] = [
  { name: 'Claude Code', command: 'claude', tone: 'clay', installable: true },
  { name: 'Codex', command: 'codex', tone: 'paper', installable: true },
  { name: 'Cursor Agent', command: 'cursor-agent', tone: 'mist', note: 'WSL setup' },
  { name: 'Gemini CLI', command: 'gemini', tone: 'star', installable: true },
  { name: 'GitHub Copilot', command: 'copilot', tone: 'paper', installable: true },
  { name: 'Grok Build', command: 'grok', tone: 'paper', note: 'Manual setup' },
  { name: 'Terminal', command: '', tone: 'terminal', note: 'Ready' },
];

const detectableCommands = agentTools.filter((tool) => tool.command).map((tool) => tool.command);

export function AgentSetup({ platform, close }: { platform: WorkspacePlatform; close(): void }) {
  const [detected, setDetected] = useState<Record<string, string | null>>({});
  const [checking, setChecking] = useState(platform.available);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = async () => {
    if (!platform.available) return;
    setChecking(true);
    try {
      setDetected(await platform.detectCommands(detectableCommands));
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
    <Modal title="Set up coding agents" close={close}>
      <section className="agent-setup">
        <p className="muted">
          This folder is ready. Install the compatible coding agents once, then launch any of them
          in a terminal for this project.
        </p>
        <div className="agent-tool-grid" aria-label="Available coding tools">
          {agentTools.map((tool) => {
            const installed = tool.command ? Boolean(detected[tool.command]) : true;
            const state = checking
              ? 'Checking…'
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
          Install all adds Codex, Claude Code, Gemini CLI, and GitHub Copilot with npm. Cursor Agent
          runs through WSL; Grok Build has no official native CLI installer to run here.
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
            disabled={!platform.available || installing}
            onClick={() => void install()}
          >
            <Icon name="sparkles" /> {installing ? 'Installing agents…' : 'Install all agents'}
          </button>
        </footer>
      </section>
    </Modal>
  );
}
