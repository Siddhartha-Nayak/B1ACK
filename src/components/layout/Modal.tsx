import { useEffect, useRef, type ReactNode } from 'react';
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close(): void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={close}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
