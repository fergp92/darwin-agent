import { useApi } from '../hooks/useApi';

export default function StatusBar() {
  const { data, error } = useApi('/api/health', 3000);

  const dotColor = error
    ? 'bg-darwin-danger'
    : data?.db_ok
      ? 'bg-darwin-accent'
      : 'bg-darwin-warning';

  const label = error
    ? 'Offline'
    : data?.db_ok
      ? 'Online'
      : 'Degraded';

  const uptime = data?.uptime_seconds
    ? formatUptime(data.uptime_seconds)
    : '--';

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-darwin-muted">Uptime: {uptime}</span>
      <div className="flex items-center gap-1.5">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="text-darwin-text">{label}</span>
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
