import { Icon } from '../ui/Icon';
import { memo, type ReactNode } from 'react';
import { TerminalPane } from './TerminalPane';
import { TerminalProviderIcon } from './TerminalProviderIcon';
import type { TerminalSession, TerminalState } from '../../types/workspace';
import type { TerminalController } from '../../services/terminal/TerminalController';
export const TerminalCard = memo(function TerminalCard({
  session,
  state,
  active,
  controller,
  select,
  rename,
  close,
  start,
  shortcuts,
  maximize,
  hide,
  maximized,
  dragHandle,
}: {
  session: TerminalSession;
  state: TerminalState;
  active: boolean;
  controller: TerminalController;
  select(id: string): void;
  rename(id: string): void;
  close(id: string): void;
  start(session: TerminalSession): void;
  shortcuts(event: KeyboardEvent): boolean;
  maximize(id: string): void;
  hide(id: string): void;
  maximized: boolean;
  dragHandle?: ReactNode;
}) {
  return (
    <section
      className={`terminal-card ${active ? 'focused' : ''}`}
      aria-label={`Terminal ${session.name}`}
      onPointerDown={() => {
        if (!active) select(session.id);
      }}
    >
      <header
        className="terminal-card-header"
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest('button,summary')) maximize(session.id);
        }}
      >
        {dragHandle}
        <TerminalProviderIcon presetId={session.presetId} name={session.name} size={14} />
        <button
          className="terminal-name"
          onClick={() => rename(session.id)}
          aria-label={`Rename terminal ${session.name}`}
          title={`Rename terminal: ${session.name}`}
        >
          {session.name}
        </button>
        <span className={`terminal-state ${state.status.toLowerCase()}`}>
          <i className={`dot ${state.status.toLowerCase()}`} />
          {state.status}
        </span>
        <button
          className="icon-button"
          aria-label={`${maximized ? 'Restore layout for' : 'Maximize'} ${session.name}`}
          title={`${maximized ? 'Restore layout for' : 'Maximize'} ${session.name}`}
          onClick={() => maximize(session.id)}
        >
          <Icon name={maximized ? 'restore' : 'maximize'} size={14} />
        </button>
        <details className="terminal-more">
          <summary
            aria-label={`More actions for ${session.name}`}
            title={`More actions for ${session.name}`}
          >
            <Icon name="more" size={14} />
          </summary>
          <div>
            <button onClick={() => rename(session.id)}>Rename</button>
            <button onClick={() => hide(session.id)}>Hide from grid</button>
            <button
              aria-label={`Restart process for ${session.name}`}
              disabled={state.status === 'Starting'}
              onClick={(event) => {
                event.currentTarget.closest('details')?.removeAttribute('open');
                start(session);
              }}
            >
              Restart process
            </button>
            <button
              aria-label={`Close terminal ${session.name}`}
              disabled={state.status === 'Starting'}
              onClick={() => close(session.id)}
            >
              Close terminal
            </button>
          </div>
        </details>
        <button
          className="icon-button terminal-action-secondary"
          aria-label={`Restart ${session.name}`}
          title="Restart process"
          disabled={state.status === 'Starting'}
          onClick={() => start(session)}
        >
          <Icon name="restart" size={14} />
        </button>
        <button
          className="icon-button terminal-action-secondary"
          aria-label={`Close ${session.name}`}
          title={`Close ${session.name}`}
          disabled={state.status === 'Starting'}
          onClick={() => close(session.id)}
        >
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="terminal-path" title={session.cwd}>
        {session.cwd}
      </div>
      {state.error && (
        <div className="terminal-error" role="alert">
          <span>{state.error}</span>
          <button onClick={() => start(session)}>Retry</button>
        </div>
      )}
      {state.status === 'Stopped' || state.status === 'Error' ? (
        <div className="terminal-stopped">
          <span className="prompt-large">›_</span>
          <h3>{state.status === 'Error' ? 'Terminal could not start' : 'Ready when you are'}</h3>
          <p>
            {state.status === 'Error'
              ? 'Check the executable and project folder, then retry.'
              : 'Configuration restored. Start a new process to continue.'}
          </p>
          <button onClick={() => start(session)}>
            {state.status === 'Error' ? 'Retry' : 'Start terminal'}
          </button>
        </div>
      ) : (
        <TerminalPane view={controller.view(session.id)} shortcuts={shortcuts} />
      )}
    </section>
  );
});
