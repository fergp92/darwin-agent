import { useApi } from '../hooks/useApi';

export default function BrainLog() {
  const { data, loading, error } = useApi('/api/brain?limit=30', 8000);

  const decisions = Array.isArray(data) ? data : [];

  return (
    <div className="bg-darwin-card border border-darwin-border rounded-lg p-4 overflow-hidden">
      <h2 className="text-sm font-semibold text-darwin-muted uppercase tracking-wider mb-3">Brain Decisions</h2>
      {loading ? (
        <p className="text-darwin-muted text-sm">Loading...</p>
      ) : error ? (
        <p className="text-darwin-danger text-sm">{error}</p>
      ) : decisions.length === 0 ? (
        <p className="text-darwin-muted text-sm">No decisions yet</p>
      ) : (
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {decisions.map((d, i) => (
            <div key={d.id ?? i} className="border-l-2 pl-3 py-1 border-darwin-border">
              <div className="flex items-center gap-2 text-xs text-darwin-muted">
                <span>{fmtTime(d.timestamp)}</span>
                <ActionBadge action={d.action ?? d.decision} />
                {d.confidence != null && (
                  <span className="text-darwin-muted">
                    {Math.round(Number(d.confidence) * 100)}%
                  </span>
                )}
              </div>
              {d.reasoning && (
                <p className="text-sm text-darwin-text/80 mt-0.5 line-clamp-2">{d.reasoning}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBadge({ action }) {
  if (!action) return null;
  const colors = {
    buy: 'bg-darwin-accent/20 text-darwin-accent',
    sell: 'bg-darwin-danger/20 text-darwin-danger',
    hold: 'bg-darwin-warning/20 text-darwin-warning',
  };
  const cls = colors[action.toLowerCase()] ?? 'bg-darwin-border text-darwin-muted';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${cls}`}>
      {action}
    </span>
  );
}

function fmtTime(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
