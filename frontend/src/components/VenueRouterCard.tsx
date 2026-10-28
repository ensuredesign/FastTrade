import type { VenueRoutingState } from '../types';

const VENUE_COLORS: Record<string, string> = {
  venue_a: '#6366F1',
  venue_b: '#10B981',
  venue_c: '#20970B',
  venue_d: '#F59E0B',
};

export function VenueRouterCard({ routing }: { routing: VenueRoutingState | null | undefined }) {
  if (!routing || routing.venues.length === 0) {
    return (
      <section className="card performance-card">
        <div className="card-header">
          <div>
            <span className="card-tag">FRAGMENTED LIQUIDITY AGGREGATION</span>
            <h2>Multi-Venue Smart Order Router (SOR) Allocation</h2>
          </div>
        </div>
        <p className="empty">Waiting for multi-venue routing snapshot…</p>
      </section>
    );
  }

  return (
    <section className="card performance-card">
      <div className="card-header">
        <div>
          <span className="card-tag">MULTI-VENUE SMART ORDER ROUTING · 4 ELECTRONIC VENUES</span>
          <h2>Fragmented Liquidity Split & Toxicity-Adjusted Venue Allocation</h2>
        </div>
        <div className="price-badge-group">
          <div className="mini-stat">
            <span>VWAP ROUTE PRICE</span>
            <strong className="mono-val">${routing.avg_price.toFixed(2)}</strong>
          </div>
          <div className="mini-stat">
            <span>EFFECTIVE SPREAD</span>
            <strong className="mono-val">{routing.effective_spread_bps.toFixed(1)} bps</strong>
          </div>
          <div className="mini-stat">
            <span>EST. ROUTE COST</span>
            <strong className="mono-val">${routing.total_cost_est.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Multi-Segment Proportional Allocation Bar */}
      <div className="venue-alloc-bar-wrap">
        <div className="venue-alloc-bar">
          {routing.venues.map(v => (
            <div
              key={v.venue_id}
              className="venue-alloc-segment"
              style={{
                width: `${Math.max(2, v.allocation_pct)}%`,
                backgroundColor: VENUE_COLORS[v.venue_id] ?? '#6366F1',
              }}
              title={`${v.venue_name}: ${v.allocation_pct}% (${v.routed_quantity} units)`}
            />
          ))}
        </div>
        <div className="venue-legend-row">
          {routing.venues.map(v => (
            <span key={v.venue_id} className="venue-legend-item">
              <span
                className="venue-dot"
                style={{ backgroundColor: VENUE_COLORS[v.venue_id] ?? '#6366F1' }}
              />
              <strong>{v.venue_name}:</strong>{' '}
              <span className="mono-val">
                {v.allocation_pct.toFixed(1)}% ({v.routed_quantity.toLocaleString()} units)
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 4 Venue Cards */}
      <div className="venue-cards-grid">
        {routing.venues.map(v => {
          const accent = VENUE_COLORS[v.venue_id] ?? '#6366F1';
          return (
            <div
              key={v.venue_id}
              className="venue-box"
              style={{ borderTop: `3px solid ${accent}` }}
            >
              <div className="venue-box-top">
                <strong>{v.venue_name}</strong>
                <span className="mono-val venue-pct" style={{ color: accent }}>
                  {v.allocation_pct.toFixed(1)}%
                </span>
              </div>

              <div className="venue-routed-banner mono-val">
                Routed: <strong>{v.routed_quantity.toLocaleString()}</strong> / {routing.total_quantity.toLocaleString()} units
              </div>

              <div className="venue-metrics-list">
                <div>
                  <span>Best Bid / Ask</span>
                  <strong className="mono-val">
                    ${v.best_bid.toFixed(2)} / ${v.best_ask.toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span>Bid / Ask Depth</span>
                  <strong className="mono-val">
                    {v.bid_depth.toFixed(0)} / {v.ask_depth.toFixed(0)}
                  </strong>
                </div>
                <div>
                  <span>Venue Spread</span>
                  <strong className="mono-val">{v.spread_bps.toFixed(1)} bps</strong>
                </div>
                <div>
                  <span>Liquidity Score</span>
                  <strong className="mono-val">{(v.liquidity_score * 100).toFixed(0)} / 100</strong>
                </div>
                <div>
                  <span>Toxicity Risk</span>
                  <strong
                    className="mono-val"
                    style={{ color: v.execution_risk >= 0.65 ? '#EF4444' : '#10B981' }}
                  >
                    {(v.execution_risk * 100).toFixed(0)}%
                  </strong>
                </div>
                <div>
                  <span>Est. All-In Cost</span>
                  <strong className="mono-val">{v.est_cost_bps.toFixed(1)} bps</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="audit-reason-box" style={{ borderLeftColor: '#6366F1' }}>
        <span className="audit-label" style={{ color: '#6366F1' }}>
          MULTI-VENUE SOR ALLOCATION RATIONALE
        </span>
        <p>{routing.explanation.replaceAll('**', '')}</p>
      </div>
    </section>
  );
}
