import { useEffect, useState } from 'react';
import type { WorkspacePlatform } from '../../services/platform';
import type { SystemStatus } from '../../types/workspace';
export function StatusBar({
  projects,
  terminals,
  running,
  platform,
}: {
  projects: number;
  terminals: number;
  running: number;
  platform: WorkspacePlatform;
}) {
  const [metrics, setMetrics] = useState<SystemStatus>();
  const [error, setError] = useState('');
  useEffect(() => {
    let done = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const m = await platform.systemStatus();
        if (!done) {
          setMetrics(m);
          setError('');
        }
      } catch {
        if (!done) setError('System metrics unavailable');
      }
      if (!done) timer = setTimeout(poll, 3000);
    };
    if (platform.available) void poll();
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [platform]);
  return (
    <footer className="statusbar">
      <span>
        <i className="dot" /> {running} running
      </span>
      <span>{projects} projects</span>
      <span>{terminals} terminals</span>
      <span className="system-metrics" title={error || 'Whole-system CPU and RAM usage'}>
        {metrics
          ? `CPU ${metrics.cpu.toFixed(0)}% · RAM ${(metrics.usedMemory / 1073741824).toFixed(1)} / ${(metrics.totalMemory / 1073741824).toFixed(1)} GB`
          : platform.available
            ? 'System metrics pending'
            : 'Desktop runtime required'}
      </span>
      <span className="status-brand">CODE MODE · LOCAL</span>
    </footer>
  );
}
