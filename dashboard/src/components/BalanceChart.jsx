import { useApi } from '../hooks/useApi';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function BalanceChart() {
  const { data, loading, error } = useApi('/api/portfolio', 30000);

  const rows = Array.isArray(data) ? [...data].reverse() : [];

  return (
    <div className="bg-darwin-card border border-darwin-border rounded-lg p-4">
      <h2 className="text-sm font-semibold text-darwin-muted uppercase tracking-wider mb-3">Portfolio (90d)</h2>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-darwin-muted">Loading...</div>
      ) : error ? (
        <div className="h-64 flex items-center justify-center text-darwin-danger text-sm">{error}</div>
      ) : rows.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-darwin-muted text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={60}
              tickFormatter={(v) => `$${v.toLocaleString()}`} />
            <Tooltip
              contentStyle={{ background: '#12121a', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Balance']}
            />
            <Area type="monotone" dataKey="total_balance_usd" stroke="#22c55e" fill="url(#balGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
