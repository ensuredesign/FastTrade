import type { PerformanceState } from '../types';
import { StrategyComparison } from '../charts/plots';
import { FileTextIcon } from './Icons';

const STRATEGY_LABELS: Record<string, string> = {
  market: 'Market Sweep (Immediate)',
  twap: 'TWAP (Time-Weighted)',
  vwap: 'VWAP (Volume-Weighted)',
  almgren_chriss: 'Almgren–Chriss Baseline',
  proposed: 'Proposed (ML Toxicity + AC)',
  fasttrade: 'FastTrade (ML + NVIDIA + AC)',
};

export function Performance({
  performance,
  midPrice = 100,
  targetQuantity = 1000,
  onOpenTCA,
}: {
  performance: PerformanceState | null;
  midPrice?: number;
  targetQuantity?: number;
  onOpenTCA?: () => void;
}) {
  if (!performance || performance.results.length === 0) {
    return (
      <section className="card performance-card">
        <div className="card-header">
          <div>
            <span className="card-tag">IDENTICAL-MARKET REPLAY BENCHMARK</span>
            <h2>Six-Strategy Execution Comparison</h2>
          </div>
        </div>
        <p className="empty">Run a simulation to compare execution strategies…</p>
      </section>
    );
  }

  const notional = midPrice * targetQuantity;
  const twapRes = performance.results.find(r => r.strategy === 'twap');
  const twapBps = twapRes?.implementation_shortfall_bps ?? 0;

  const minShortfall = Math.min(...performance.results.map(r => r.implementation_shortfall_bps));

  return (
    <section className="card performance-card">
      <div className="card-header">
        <div>
          <span className="card-tag">IDENTICAL-MARKET REPLAY BENCHMARK · RUN {performance.run_id}</span>
          <h2>Multi-Strategy Implementation Shortfall & Alpha Attribution</h2>
        </div>
        {onOpenTCA && (
          <button type="button" className="btn-nvidia" onClick={onOpenTCA}>
            <FileTextIcon size={15} /> Generate Full Nemotron-3 Ultra 550B TCA Audit
          </button>
        )}
      </div>

      <StrategyComparison results={performance.results} />

      <div className="table-wrap">
        <table className="perf-table">
          <thead>
            <tr>
              <th>Execution Strategy</th>
              <th>Filled Qty</th>
              <th>Fill Rate</th>
              <th>Slippage</th>
              <th>Market Impact</th>
              <th>Adverse Selection</th>
              <th>Impl. Shortfall (IS)</th>
              <th>Est. Cost ($)</th>
              <th>Alpha vs TWAP</th>
            </tr>
          </thead>
          <tbody>
            {performance.results.map(r => {
              const isBest = Math.abs(r.implementation_shortfall_bps - minShortfall) < 0.01;
              const isFastTrade = r.strategy === 'fasttrade' || r.strategy === 'proposed';
              const estCostUsd = (r.implementation_shortfall_bps / 10000) * notional;
              const alphaVsTwapBps = twapBps - r.implementation_shortfall_bps;
              const alphaVsTwapUsd = (alphaVsTwapBps / 10000) * notional;

              return (
                <tr
                  key={r.strategy}
                  className={`${isFastTrade ? 'highlight-row' : ''} ${isBest ? 'best-row' : ''}`}
                >
                  <td>
                    <strong>{STRATEGY_LABELS[r.strategy] ?? r.strategy}</strong>
                    {isBest && <span className="winner-pill">BEST IS</span>}
                  </td>
                  <td className="mono-val">{r.filled_quantity.toLocaleString()}</td>
                  <td className="mono-val">{(r.fill_rate * 100).toFixed(1)}%</td>
                  <td className="mono-val">{r.slippage_bps.toFixed(2)} bps</td>
                  <td className="mono-val">{r.market_impact_bps.toFixed(2)} bps</td>
                  <td className="mono-val">{r.adverse_selection_bps.toFixed(2)} bps</td>
                  <td className="mono-val">
                    <strong style={{ color: r.implementation_shortfall_bps <= 5 ? '#10B981' : '#0A0A0A' }}>
                      {r.implementation_shortfall_bps.toFixed(2)} bps
                    </strong>
                  </td>
                  <td className="mono-val">${estCostUsd.toFixed(2)}</td>
                  <td className="mono-val">
                    {r.strategy === 'twap' ? (
                      <span className="muted-dash">Baseline</span>
                    ) : (
                      <strong className={alphaVsTwapBps >= 0 ? 'bid-text' : 'ask-text'}>
                        {alphaVsTwapBps >= 0 ? '+' : ''}
                        {alphaVsTwapBps.toFixed(2)} bps ({alphaVsTwapUsd >= 0 ? '+' : ''}${alphaVsTwapUsd.toFixed(2)})
                      </strong>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
