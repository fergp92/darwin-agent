import { useApi } from '../hooks/useApi';

export default function TradeList() {
  const { data, loading, error } = useApi('/api/trades?limit=20', 10000);

  const trades = Array.isArray(data) ? data : [];

  return (
    <div className="bg-darwin-card border border-darwin-border rounded-lg p-4 overflow-hidden">
      <h2 className="text-sm font-semibold text-darwin-muted uppercase tracking-wider mb-3">Recent Trades</h2>
      {loading ? (
        <p className="text-darwin-muted text-sm">Loading...</p>
      ) : error ? (
        <p className="text-darwin-danger text-sm">{error}</p>
      ) : trades.length === 0 ? (
        <p className="text-darwin-muted text-sm">No trades yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-darwin-muted text-xs uppercase border-b border-darwin-border">
                <th className="text-left py-2 pr-3">Time</th>
                <th className="text-left py-2 pr-3">Pair</th>
                <th className="text-left py-2 pr-3">Side</th>
                <th className="text-right py-2 pr-3">Amount</th>
                <th className="text-right py-2">P&L</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => (
                <tr key={t.id ?? i} className="border-b border-darwin-border/40 last:border-0">
                  <td className="py-1.5 pr-3 text-darwin-muted whitespace-nowrap">{fmtTime(t.timestamp)}</td>
                  <td className="py-1.5 pr-3 font-medium">{t.pair ?? t.token ?? '--'}</td>
                  <td className={`py-1.5 pr-3 font-medium ${t.side === 'buy' ? 'text-darwin-accent' : 'text-darwin-danger'}`}>
                    {(t.side ?? '--').toUpperCase()}
                  </td>
                  <td className="py-1.5 pr-3 text-right">{fmtNum(t.amount_usd ?? t.amount)}</td>
                  <td className={`py-1.5 text-right font-medium ${pnlColor(t.pnl_usd ?? t.pnl)}`}>
                    {fmtPnl(t.pnl_usd ?? t.pnl)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtTime(ts) {
  if (!ts) return '--';
  const d = new Date(ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtNum(n) {
  if (n == null) return '--';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPnl(n) {
  if (n == null) return '--';
  const v = Number(n);
  const sign = v >= 0 ? '+' : '';
  return `${sign}$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pnlColor(n) {
  if (n == null) return 'text-darwin-muted';
  return Number(n) >= 0 ? 'text-darwin-accent' : 'text-darwin-danger';
}
