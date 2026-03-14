import { useApi } from '../hooks/useApi';

export default function BalanceCard() {
  const { data, loading } = useApi('/api/status', 5000);

  if (loading || !data) {
    return <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} />)}</div>;
  }

  const cards = [
    { label: 'Total Balance', value: fmt(data.total_balance_usd ?? data.totalBalance), unit: 'USD' },
    { label: 'Tier', value: data.tier ?? data.currentTier ?? '--', unit: '' },
    { label: 'Mode', value: data.mode ?? data.tradingMode ?? '--', unit: '' },
    { label: 'Chains', value: formatChains(data.chains ?? data.balances), unit: '' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-darwin-card border border-darwin-border rounded-lg p-4">
          <p className="text-darwin-muted text-xs uppercase tracking-wider mb-1">{c.label}</p>
          <p className="text-xl font-semibold">
            {c.value}
            {c.unit && <span className="text-darwin-muted text-sm ml-1">{c.unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return <div className="bg-darwin-card border border-darwin-border rounded-lg p-4 h-20 animate-pulse" />;
}

function fmt(n) {
  if (n == null) return '--';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChains(chains) {
  if (!chains || typeof chains !== 'object') return '--';
  if (Array.isArray(chains)) return chains.length.toString();
  return Object.keys(chains).join(', ');
}
