import { useEffect, useState } from 'react';
import type { Project, TerminalSession, CliPreset } from '../../types/workspace';
import type { WorkspacePlatform } from '../../services/platform';
import { builtInPresets } from '../../features/terminals/presets';
import { Modal } from '../layout/Modal';
export function NewTerminal({
  project,
  count,
  create,
  close,
  platform,
  customPresets,
  savePreset,
  deletePreset,
}: {
  project: Project;
  count: number;
  create(t: TerminalSession): void;
  close(): void;
  platform: WorkspacePlatform;
  customPresets: CliPreset[];
  savePreset(p: CliPreset): void;
  deletePreset(id: string): void;
}) {
  const all = [...builtInPresets, ...customPresets];
  const [presetId, setPresetId] = useState('codex');
  const selected = all.find((p) => p.id === presetId);
  const [name, setName] = useState(`Codex-${count + 1}`);
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('[]');
  const [cwd, setCwd] = useState(project.path);
  const [presetName, setPresetName] = useState('');
  const [save, setSave] = useState(false);
  const [error, setError] = useState('');
  const [detected, setDetected] = useState<Record<string, string | null>>({});
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const executable = selected?.command ?? command.trim();
  const detect = async () => {
    setChecking(true);
    try {
      setDetected(
        await platform.detectCommands([
          ...new Set([...all.map((p) => p.command), ...(command.trim() ? [command.trim()] : [])]),
        ]),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    void detect();
  }, []);
  const parsedArgs = () => {
    const result: unknown = selected
      ? selected.id === 'wsl'
        ? ['--cd', cwd, ...selected.args]
        : selected.args
      : JSON.parse(args);
    if (!Array.isArray(result) || !result.every((a) => typeof a === 'string'))
      throw new Error('Arguments must be a JSON array of strings.');
    return result;
  };
  const persistPreset = () => {
    const name = presetName.trim();
    if (!name || !command.trim()) throw new Error('Enter a preset name and executable.');
    const id = `custom-${crypto.randomUUID()}`;
    savePreset({
      id,
      name,
      command: command.trim(),
      args: parsedArgs(),
      builtIn: false,
      category: 'Custom',
      icon: '>_',
    });
    return id;
  };
  return (
    <Modal title="New terminal" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          setError('');
          void (async () => {
            try {
              if (!executable) throw new Error('Enter an executable name or path.');
              const args = parsedArgs();
              const folder = await platform.validateFolder(cwd);
              const found = await platform.detectCommands([executable]);
              setDetected((old) => ({ ...old, ...found }));
              if (!found[executable])
                throw new Error(
                  `${selected?.name ?? 'Custom CLI'} was not found in PATH. Install it and Retry; restart ParallelADE if PATH changed.`,
                );
              const savedId = save && !selected ? persistPreset() : selected?.id;
              create({
                id: crypto.randomUUID(),
                projectId: project.id,
                name: name.trim() || selected?.name || 'Terminal',
                presetId: savedId ?? 'custom',
                command: executable,
                args,
                cwd: folder,
                createdAt: Date.now(),
              });
            } catch (e) {
              setError(String(e));
            } finally {
              setSubmitting(false);
            }
          })();
        }}
      >
        <p className="muted">Independent local CLI · {project.name}</p>
        <label>
          Terminal type
          <select
            value={presetId}
            onChange={(e) => {
              const id = e.target.value;
              setPresetId(id);
              setError('');
              const p = all.find((p) => p.id === id);
              setName(`${p?.name.replace(' CLI', '') ?? 'Custom'}-${count + 1}`);
            }}
          >
            {(['Coding Agents', 'Shells', 'Custom'] as const).map((category) => (
              <optgroup label={category} key={category}>
                {all
                  .filter((p) => p.category === category)
                  .map((p) => (
                    <option value={p.id} key={p.id}>
                      {p.name}
                    </option>
                  ))}
                {category === 'Custom' && <option value="custom">Custom CLI</option>}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="cli-detection" aria-live="polite">
          <span>
            {checking
              ? 'Checking PATH…'
              : executable in detected
                ? detected[executable]
                  ? 'Installed ✓'
                  : `${selected?.name ?? 'Custom CLI'} was not found in PATH.`
                : 'Check executable availability'}
          </span>
          <button type="button" onClick={() => void detect()} disabled={checking}>
            Retry detection
          </button>
        </div>
        <label>
          Name
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {!selected && (
          <>
            <label>
              Executable
              <input
                required
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Executable name or full path"
              />
            </label>
            <label>
              Arguments (JSON array)
              <input
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                placeholder={'["--flag", "argument with spaces"]'}
              />
            </label>
            <label className="check-label">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} />
              Save as a reusable preset
            </label>
            {save && (
              <label>
                Preset name
                <input
                  required
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </label>
            )}
            <p className="muted">
              Use a shell executable with its command argument for shell syntax. No provider API is
              used.
            </p>
          </>
        )}
        {selected && !selected.builtIn && (
          <button
            type="button"
            onClick={() => {
              deletePreset(selected.id);
              setPresetId('custom');
            }}
          >
            Delete saved preset
          </button>
        )}
        <label>
          Working directory
          <input required value={cwd} onChange={(e) => setCwd(e.target.value)} />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          {save && !selected && (
            <button
              type="button"
              onClick={() => {
                try {
                  persistPreset();
                  setSave(false);
                  setError('');
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Save preset only
            </button>
          )}
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Starting…' : 'Start terminal'}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
