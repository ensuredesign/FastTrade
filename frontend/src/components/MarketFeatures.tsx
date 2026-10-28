import type { FeatureState } from '../types';
import { FeatureLineChart, MarketDepthChart } from '../charts/plots';

export function MarketFeatures({ features }: { features: FeatureState | null }) {
  const points = features?.points ?? [];
  return (
    <section className="card feature-card">
      <div className="card-header">
        <div>
          <span className="card-tag">ZERO-LEAKAGE MICROSTRUCTURE TELEMETRY · 80 TICKS</span>
          <h2>High-Frequency Market Microstructure Signals</h2>
        </div>
        <span className="card-sub-pill">Cont-Kukanov-Stoikov OFI · Stoikov Micro-Price · Realized Vol</span>
      </div>

      {points.length === 0 ? (
        <p className="empty">Waiting for feature history…</p>
      ) : (
        <div className="feature-grid">
          <FeatureLineChart points={points} metric="spread_bps" title="Bid-Ask Spread" unit="bps" color="#F59E0B" />
          <FeatureLineChart
            points={points}
            metric="depth_imbalance_l1"
            title="L1 Depth Imbalance"
            unit="ratio"
            color="#10B981"
          />
          <FeatureLineChart
            points={points}
            metric="ofi_instant"
            title="Order Flow Imbalance (OFI)"
            unit="qty"
            color="#6366F1"
          />
          <FeatureLineChart
            points={points}
            metric="volatility_std_10"
            title="Realized Volatility (10-Tick)"
            unit="%"
            multiplier={100}
            color="#4F46E5"
          />
          <FeatureLineChart
            points={points}
            metric="momentum_ret_5"
            title="Price Velocity (5-Tick)"
            unit="%"
            multiplier={100}
            color="#EF4444"
          />
          <MarketDepthChart points={points} />
        </div>
      )}
    </section>
  );
}
