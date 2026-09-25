import type { ReactNode } from 'react';

type Provider =
  | 'codex'
  | 'claude'
  | 'gemini'
  | 'copilot'
  | 'cursor-agent'
  | 'powershell'
  | 'cmd'
  | 'wsl'
  | 'terminal';

const marks: Record<Provider, ReactNode> = {
  // Geometric shorthand marks, intentionally distinct from vendor logos.
  codex: (
    <>
      <circle cx="12" cy="12" r="7.2" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  claude: (
    <>
      <path d="M12 3.5v17M4.6 7.7l14.8 8.6M4.6 16.3l14.8-8.6" />
      <circle cx="12" cy="12" r="2.1" />
    </>
  ),
  gemini: (
    <path d="M12 2.8c.8 4.5 3 7.7 9.2 9.2-6.2 1.5-8.4 4.7-9.2 9.2-.8-4.5-3-7.7-9.2-9.2 6.2-1.5 8.4-4.7 9.2-9.2Z" />
  ),
  copilot: (
    <>
      <rect x="3.5" y="5" width="11" height="11" rx="3" />
      <path d="M9.5 19h8a3 3 0 0 0 3-3V9" />
      <path d="M8 10.5h2" />
    </>
  ),
  'cursor-agent': (
    <>
      <path d="m5 3 13 9-6 .8-2.8 5.7L5 3Z" />
      <path d="m13 14 4.5 5" />
    </>
  ),
  powershell: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="m7 9 4 3-4 3m6 0h4" />
    </>
  ),
  cmd: (
    <>
      <path d="M5 6.5h14M5 12h9M5 17.5h6" />
      <path d="m17 10 2.5 2-2.5 2" />
    </>
  ),
  wsl: (
    <>
      <path d="M6 6.5h12M4.5 12h15M6 17.5h12" />
      <circle cx="5" cy="6.5" r="1" />
      <circle cx="19" cy="17.5" r="1" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 7 5 5-5 5m8 0h6" />
    </>
  ),
};

function inferProvider(presetId: string | undefined, name: string): Provider {
  const id = (presetId ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (
    id === 'codex' ||
    id === 'claude' ||
    id === 'gemini' ||
    id === 'copilot' ||
    id === 'cursor-agent' ||
    id === 'powershell' ||
    id === 'cmd' ||
    id === 'wsl'
  ) {
    return id;
  }

  const source = `${id} ${name}`.toLowerCase();
  if (/\bcodex\b/.test(source)) return 'codex';
  if (/\bclaude(?:-?code)?\b/.test(source)) return 'claude';
  if (/\bgemini(?:-?cli)?\b/.test(source)) return 'gemini';
  if (/\bcopilot\b/.test(source)) return 'copilot';
  if (/\bcursor(?:-agent)?\b/.test(source)) return 'cursor-agent';
  if (/\bpowershell\b|\bpwsh\b/.test(source)) return 'powershell';
  if (/\bcmd(?:\.exe)?\b|\bcommand prompt\b/.test(source)) return 'cmd';
  if (/\bwsl\b|\blinux subsystem\b/.test(source)) return 'wsl';
  return 'terminal';
}

export function TerminalProviderIcon({
  presetId,
  name,
  size = 15,
}: {
  presetId?: string;
  name: string;
  size?: number;
}) {
  const provider = inferProvider(presetId, name);
  return (
    <span className="terminal-provider-mark" data-provider={provider} aria-hidden="true">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {marks[provider]}
      </svg>
    </span>
  );
}
