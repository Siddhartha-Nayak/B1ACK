import { useState } from 'react';
import type { LaunchPreset } from '../../types/workspace';
import { Modal } from '../../components/layout/Modal';
import './launch-presets.css';

export interface LaunchPresetsModalProps {
  presets: LaunchPreset[];
  projectName: string;
  onSave(name: string): void;
  onLaunch(preset: LaunchPreset): void;
  onDelete(id: string): void;
  close(): void;
}

/** Project-scoped launcher for reproducible terminal groups. */
export function LaunchPresetsModal({
  presets,
  projectName,
  onSave,
  onLaunch,
  onDelete,
  close,
}: LaunchPresetsModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const save = () => {
    const value = name.trim();
    if (!value) {
      setError('Give this launch a name first.');
      return;
    }
    try {
      onSave(value);
      setName('');
      setError('');
    } catch (cause) {
      setError(String(cause));
    }
  };

  return (
    <Modal title="Launch presets" close={close}>
      <div className="launch-presets">
        <p className="muted launch-presets-intro">
          Save the current terminal group for <strong>{projectName}</strong>, then reopen it in one
          click.
        </p>

        <form
          className="launch-presets-create"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <label>
            Preset name
            <input
              value={name}
              placeholder="Codex + tests + logs"
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError('');
              }}
              autoFocus
            />
          </label>
          <button className="primary" type="submit">
            Save current layout
          </button>
        </form>
        {error && <p className="launch-presets-error">{error}</p>}

        <div className="launch-presets-list" aria-live="polite">
          {presets.length === 0 ? (
            <div className="launch-presets-empty">
              <span className="launch-presets-glyph" aria-hidden="true">
                ▦
              </span>
              <p>No launch presets yet.</p>
              <span>Save this project’s current terminal layout to make it reusable.</span>
            </div>
          ) : (
            presets.map((preset) => (
              <article className="launch-preset" key={preset.id}>
                <div className="launch-preset-copy">
                  <strong>{preset.name}</strong>
                  <span>
                    {preset.terminals.length} terminal{preset.terminals.length === 1 ? '' : 's'} ·{' '}
                    {preset.layout}
                    {preset.gridColumns ? ` · ${preset.gridColumns} columns` : ''}
                  </span>
                </div>
                <div className="launch-preset-actions">
                  <button
                    className="primary"
                    type="button"
                    onClick={() => {
                      try {
                        onLaunch(preset);
                      } catch (cause) {
                        setError(String(cause));
                      }
                    }}
                    disabled={preset.terminals.length === 0}
                  >
                    Launch
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Delete ${preset.name}`}
                    title="Delete preset"
                    onClick={() => {
                      try {
                        onDelete(preset.id);
                      } catch (cause) {
                        setError(String(cause));
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
