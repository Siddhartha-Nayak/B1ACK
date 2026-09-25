import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from '../../components/ui/Icon';
import { TerminalPane } from '../../components/terminal/TerminalPane';
import type { TerminalController } from '../../services/terminal/TerminalController';
import type { TerminalService } from '../../services/terminal/TerminalService';
import type { TerminalSession, TerminalState } from '../../types/workspace';
import './conversation.css';

/**
 * Conversation-style shell for an existing interactive CLI session.
 * Output remains rendered by xterm because agent CLIs can emit rich terminal
 * control sequences; the composer writes directly to the same PTY.
 */
export function AgentConversation({
  session,
  state,
  controller,
  service,
  shortcuts,
  branch,
  model,
  onStart,
}: {
  session: TerminalSession;
  state: TerminalState;
  controller: TerminalController;
  service: TerminalService;
  shortcuts: (event: globalThis.KeyboardEvent) => boolean;
  branch?: string;
  model?: string;
  onStart?: (session: TerminalSession) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const canSend = state.status === 'Running' && prompt.trim().length > 0 && !sending;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const message = prompt.trim();
    if (!message || state.status !== 'Running' || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await service.write(session.id, `${message}\r`);
      setPrompt('');
    } catch (error) {
      setSendError(String(error));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <section className="agent-conversation" aria-label={`Conversation with ${session.name}`}>
      <header className="agent-conversation-header">
        <div className="agent-conversation-identity">
          <span className={`agent-conversation-indicator ${state.status.toLowerCase()}`} />
          <span className="agent-conversation-title">{session.name}</span>
          {model && <span className="agent-conversation-model">{model}</span>}
        </div>
        <span className="agent-conversation-live-label">
          <Icon name="terminal" size={13} />
          Live CLI
        </span>
      </header>

      <div className="agent-conversation-stream" aria-label="Live agent output">
        {state.status === 'Stopped' || state.status === 'Error' ? (
          <div className="agent-conversation-empty">
            <span className="agent-conversation-empty-mark">↳</span>
            <strong>
              {state.status === 'Error' ? 'Could not start this session' : 'Ready when you are'}
            </strong>
            <p>
              {state.status === 'Error'
                ? (state.error ?? 'Check the command and project folder, then retry.')
                : 'Start the agent to see its live output here.'}
            </p>
            {onStart && <button onClick={() => onStart(session)}>Start session</button>}
          </div>
        ) : (
          <TerminalPane view={controller.view(session.id)} shortcuts={shortcuts} />
        )}
      </div>

      <form
        className="agent-composer"
        onSubmit={(event) => void submit(event)}
        aria-label="Send a message to the agent"
      >
        <div className="agent-composer-context">
          <span className="agent-composer-path" title={session.cwd}>
            {session.cwd}
          </span>
          {branch && <span className="agent-composer-branch">{branch}</span>}
        </div>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            state.status === 'Running'
              ? 'Message the agent…'
              : 'Start the session to send a message'
          }
          aria-label="Message the agent"
          disabled={state.status !== 'Running' || sending}
          rows={3}
        />
        {sendError && (
          <div className="agent-composer-error" role="alert">
            {sendError}
          </div>
        )}
        {state.waitingForInput && (
          <div className="agent-composer-hint" role="status">
            The agent is waiting for input.
          </div>
        )}
        <div className="agent-composer-footer">
          <span>Enter to send · Shift+Enter for a new line</span>
          <button type="submit" disabled={!canSend} aria-label="Send message" title="Send message">
            <span>{sending ? 'Sending' : 'Send'}</span>
            <Icon name="terminal" size={15} />
          </button>
        </div>
      </form>
    </section>
  );
}
