import StatusBar from './components/StatusBar';
import BalanceCard from './components/BalanceCard';
import BalanceChart from './components/BalanceChart';
import TradeList from './components/TradeList';
import StrategyPanel from './components/StrategyPanel';
import BrainLog from './components/BrainLog';

export default function App() {
  return (
    <div className="min-h-screen bg-darwin-bg text-darwin-text p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Darwin <span className="text-darwin-muted font-normal text-lg">— Autonomous Trading Agent</span>
        </h1>
        <StatusBar />
      </header>

      {/* Balance cards row */}
      <section className="mb-6">
        <BalanceCard />
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <BalanceChart />
        <StrategyPanel />
      </section>

      {/* Bottom row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TradeList />
        <BrainLog />
      </section>
    </div>
  );
}
