import type { MarketState } from '../types';

export function OrderBook({ market }: { market: MarketState | null }) {
  if (!market) {
    return (
      <section className="card">
        <div className="card-header">
          <div>
            <span className="card-tag">L2 LIMIT ORDER BOOK</span>
            <h2>Market Depth Ladder</h2>
          </div>
        </div>
        <p className="empty">Waiting for L2 order book stream…</p>
      </section>
    );
  }

  const maxBidQty = Math.max(1, ...market.bids.map(b => b.quantity));
  const maxAskQty = Math.max(1, ...market.asks.map(a => a.quantity));
  const maxQty = Math.max(maxBidQty, maxAskQty);

  const totalBidVol = market.bids.reduce((sum, b) => sum + b.quantity, 0);
  const totalAskVol = market.asks.reduce((sum, a) => sum + a.quantity, 0);
  const spreadBps = market.mid_price > 0 ? ((market.spread / market.mid_price) * 10000).toFixed(2) : '0.00';

  const ofi = market.order_flow_imbalance;
  const ofiPct = ((ofi + 1) / 2) * 100; // maps [-1, 1] -> [0%, 100%]

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="card-tag">L2 LIMIT ORDER BOOK · 5 LEVELS</span>
          <h2>{market.symbol} Depth & Liquidity Ladder</h2>
        </div>
        <div className="price-badge-group">
          <div className="mini-stat">
            <span>MID PRICE</span>
            <strong className="mono-val">${market.mid_price.toFixed(2)}</strong>
          </div>
          <div className="mini-stat">
            <span>SPREAD</span>
            <strong className="mono-val">
              ${market.spread.toFixed(2)} <small>({spreadBps} bps)</small>
            </strong>
          </div>
        </div>
      </div>

      {/* Order Book Imbalance Gauge */}
      <div className="imbalance-meter-wrap">
        <div className="imbalance-labels">
          <span className="bid-text">BID LIQUIDITY ({totalBidVol.toFixed(0)})</span>
          <span className="mono-val">
            L1 IMBALANCE: <strong style={{ color: ofi >= 0 ? '#10B981' : '#EF4444' }}>{ofi >= 0 ? '+' : ''}{ofi.toFixed(3)}</strong>
          </span>
          <span className="ask-text">ASK LIQUIDITY ({totalAskVol.toFixed(0)})</span>
        </div>
        <div className="imbalance-bar-track">
          <div className="imbalance-bar-fill" style={{ width: `${Math.min(100, Math.max(0, ofiPct))}%` }} />
        </div>
      </div>

      {/* Dual L2 Depth Ladder */}
      <div className="lob-ladder">
        <div className="lob-side">
          <div className="lob-col-header">
            <span>LVL</span>
            <span>BID QTY</span>
            <span className="right">BID PRICE</span>
          </div>
          {market.bids.map((level, i) => {
            const widthPct = Math.min(100, (level.quantity / maxQty) * 100);
            return (
              <div key={`bid-${i}`} className="lob-row bid-row">
                <div className="lob-depth-bar bid-bar" style={{ width: `${widthPct}%` }} />
                <span className="lob-lvl">B{i + 1}</span>
                <span className="lob-qty mono-val">{level.quantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span className="lob-price bid-text mono-val">${level.price.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        <div className="lob-side">
          <div className="lob-col-header">
            <span>ASK PRICE</span>
            <span className="right">ASK QTY</span>
            <span className="right">LVL</span>
          </div>
          {market.asks.map((level, i) => {
            const widthPct = Math.min(100, (level.quantity / maxQty) * 100);
            return (
              <div key={`ask-${i}`} className="lob-row ask-row">
                <div className="lob-depth-bar ask-bar" style={{ width: `${widthPct}%` }} />
                <span className="lob-price ask-text mono-val">${level.price.toFixed(2)}</span>
                <span className="lob-qty mono-val right">{level.quantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span className="lob-lvl right">A{i + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lob-footer">
        <span>Snapshot UTC: <strong className="mono-val">{new Date(market.timestamp).toLocaleTimeString()}</strong></span>
        <span>Stoikov Micro-Price Active</span>
      </div>
    </section>
  );
}
