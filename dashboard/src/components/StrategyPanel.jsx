import { useApi } from '../hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function StrategyPanel() {
  const { data, loading, error } = useApi('/api/strategies', 15000);

  // Group by strategy name, sum PnL
  const rows = aggregateByStrategy(Array.isArray(data) ? data : []);

  return (
    <div className="bg-darwin-card border border-darwin-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-darwin-muted uppercase tracking-wider mb-3">Strategy P&L</h2>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-darwin-muted">Loading...</div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-darwin-danger text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-darwin-muted text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="strategy" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={60}
              tickFormatter={(v) => `$${v}`} />
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, 'P&L']}
            />
            <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
              {rows.map((entry, i) => (
                <Cell key={i} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function aggregateByStrategy(records) {
  const map = {};
  for (const r of records) {
    const name = r.strategy ?? r.name ?? 'unknown';
    if (!map[name]) map[name] = { strategy: name, pnl: 0, trades: 0 };
    map[name].pnl += Number(r.pnl_usd ?? r.pnl ?? 0);
    map[name].trades += Number(r.trade_count ?? r.trades ?? 1);
  }
  return Object.values(map).sort((a, b) => b.pnl - a.pnl);
}
