import { useEffect, useRef, useState } from 'react';
import { fileLibrary, type LibraryEntry } from '../../services/fileLibrary';
import './library.css';
export function FileLibrary({ close }: { close(): void }) {
  const panel = useRef<HTMLElement>(null);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<LibraryEntry | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () =>
    setEntries((await fileLibrary.list()).sort((a, b) => a.name.localeCompare(b.name)));
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (e) {
      setMessage(String(e));
    } finally {
      try {
        await refresh();
      } catch (e) {
        setMessage(String(e));
      }
      setBusy(false);
    }
  };
  useEffect(() => {
    panel.current?.focus();
    void refresh().catch((e) => setMessage(String(e)));
  }, []);
  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    setText(null);
    setImage(null);
    setMessage('');
    if (selected) {
      const extension = selected.name.split('.').pop()?.toLowerCase() ?? '';
      const images: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        webp: 'image/webp',
        bmp: 'image/bmp',
      };
      const isText =
        /^(txt|md|markdown|json|csv|log|yaml|yml|xml|html|css|js|ts|py|rs|sh|ps1|toml|ini)$/.test(
          extension,
        );
      if (images[extension] || isText)
        void fileLibrary
          .read(selected.id)
          .then((bytes) => {
            if (disposed) return;
            if (images[extension]) {
              url = URL.createObjectURL(
                new Blob([new Uint8Array(bytes)], { type: images[extension] }),
              );
              setImage(url);
            } else setText(new TextDecoder().decode(new Uint8Array(bytes)));
          })
          .catch((e) => {
            if (!disposed) setMessage(String(e));
          });
    }
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [selected]);
  return (
    <section
      ref={panel}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
      className="file-library"
      aria-label="File library"
      onPaste={(event) => {
        const files = Array.from(event.clipboardData.files);
        if (!files.length || busy) return;
        event.preventDefault();
        void run(async () => {
          for (const file of files) {
            if (file.size > 10 * 1024 * 1024)
              throw new Error('For files above 10 MB, use Import files.');
            await fileLibrary.save(
              file.name || 'clipboard.png',
              new Uint8Array(await file.arrayBuffer()),
            );
          }
          setMessage('Clipboard file saved.');
        });
      }}
    >
      <header>
        <div>
          <span className="eyebrow">PERSONAL STORAGE</span>
          <h2>Library</h2>
        </div>
        <button aria-label="Close library" onClick={close}>
          Close
        </button>
      </header>
      <p className="library-hint">Available in every workspace. Your terminals keep running.</p>
      <div className="library-tools">
        <button disabled={busy} onClick={() => void run(() => fileLibrary.import())}>
          Import files
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setCreating(true);
            setSelected(null);
          }}
        >
          New prompt
        </button>
      </div>
      <input
        aria-label="Search library"
        placeholder="Find a saved file…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="library-hint">Paste a copied image here with Ctrl+V.</p>
      <div className="library-items">
        {entries
          .filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
          .map((entry) => (
            <button
              key={entry.id}
              aria-pressed={entry.id === selected?.id}
              onClick={() => {
                setSelected(entry);
                setCreating(false);
              }}
            >
              <span>{entry.name}</span>
              <small>{Math.ceil(entry.size / 1024)} KB</small>
            </button>
          ))}
        {!entries.length && (
          <p className="library-hint">
            Keep reusable prompts, notes and files here. Imported files are independent copies.
          </p>
        )}
      </div>
      {creating && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await fileLibrary.save(
                name.trim().includes('.') ? name.trim() : `${name.trim()}.md`,
                new TextEncoder().encode(draft),
              );
              setCreating(false);
              setName('');
              setDraft('');
              setMessage('Prompt saved.');
            });
          }}
        >
          <label>
            Filename
            <input
              required
              maxLength={255}
              placeholder="review-prompt.md"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Prompt or note
            <textarea required value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button disabled={busy || !name.trim()} type="submit">
            Save prompt
          </button>
        </form>
      )}
      {selected && (
        <div className="library-preview">
          <h3>{selected.name}</h3>
          {image && <img src={image} alt={selected.name} />}
          {text !== null && <textarea aria-label="Saved text" readOnly value={text} />}
          {!image && text === null && (
            <p className="library-hint">Export a copy to open in another application.</p>
          )}
          <div className="library-tools">
            {text !== null && (
              <button
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(text);
                    setMessage('Text copied.');
                  })
                }
              >
                Copy text
              </button>
            )}
            <button disabled={busy} onClick={() => void run(() => fileLibrary.export(selected))}>
              Export copy
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Delete “${selected.name}” from Library? The original file is unaffected.`,
                  )
                )
                  void run(async () => {
                    await fileLibrary.remove(selected.id);
                    setSelected(null);
                  });
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <p role="status">{busy ? 'Working…' : message}</p>
    </section>
  );
}
