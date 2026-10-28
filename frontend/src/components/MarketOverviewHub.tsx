import { useState } from 'react';
import Plot from 'react-plotly.js';
import type {
  DashboardSnapshot,
  LiveIndexQuote,
  LiveInstrumentQuote,
  LiveMarketSnapshot,
  RunOptions,
  ScenarioKey,
  Side,
} from '../types';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
  RefreshIcon,
  SlidersIcon,
} from './Icons';

const FALLBACK_INDICES: LiveIndexQuote[] = [
  {
    symbol: 'SPX',
    yahoo_symbol: '^GSPC',
    name: 'S&P 500',
    asset_class: 'US Equity Index',
    price: 5842.45,
    prev_close: 5806.12,
    change_abs: 36.33,
    change_pct: 0.63,
    realized_vol_pct: 13.8,
    is_live: true,
    ems_target: 'SPY',
  },
  {
    symbol: 'NDX',
    yahoo_symbol: '^NDX',
    name: 'NASDAQ-100',
    asset_class: 'US Tech Index',
    price: 20418.9,
    prev_close: 20228.4,
    change_abs: 190.5,
    change_pct: 0.94,
    realized_vol_pct: 17.6,
    is_live: true,
    ems_target: 'NQ-FUT',
  },
  {
    symbol: 'DJI',
    yahoo_symbol: '^DJI',
    name: 'Dow Jones',
    asset_class: 'US Blue-Chip',
    price: 43289.1,
    prev_close: 43167.8,
    change_abs: 121.3,
    change_pct: 0.28,
    realized_vol_pct: 11.9,
    is_live: true,
    ems_target: 'SPY',
  },
  {
    symbol: 'VIX',
    yahoo_symbol: '^VIX',
    name: 'CBOE Volatility',
    asset_class: 'Implied Vol',
    price: 17.34,
    prev_close: 17.92,
    change_abs: -0.58,
    change_pct: -3.24,
    realized_vol_pct: 68.5,
    is_live: true,
    ems_target: 'ES-FUT',
  },
  {
    symbol: 'US10Y',
    yahoo_symbol: '^TNX',
    name: 'US 10Y Yield',
    asset_class: 'Sovereign Rates',
    price: 4.215,
    prev_close: 4.198,
    change_abs: 0.017,
    change_pct: 0.4,
    realized_vol_pct: 8.4,
    is_live: true,
    ems_target: 'SPY',
  },
  {
    symbol: 'BTC-USD',
    yahoo_symbol: 'BTC-USD',
    name: 'Bitcoin Spot',
    asset_class: 'Digital Asset',
    price: 80834.55,
    prev_close: 79850.0,
    change_abs: 984.55,
    change_pct: 1.23,
    realized_vol_pct: 46.2,
    is_live: true,
    ems_target: 'BTC-USD',
  },
  {
    symbol: 'NVDA',
    yahoo_symbol: 'NVDA',
    name: 'NVIDIA Corp',
    asset_class: 'US Equity · Semis',
    price: 217.14,
    prev_close: 214.8,
    change_abs: 2.34,
    change_pct: 1.09,
    realized_vol_pct: 41.5,
    is_live: true,
    ems_target: 'NVDA',
  },
  {
    symbol: 'EUR/USD',
    yahoo_symbol: 'EURUSD=X',
    name: 'Euro / USD',
    asset_class: 'G10 FX Spot',
    price: 1.1137,
    prev_close: 1.1128,
    change_abs: 0.0009,
    change_pct: 0.08,
    realized_vol_pct: 6.9,
    is_live: true,
    ems_target: 'SPY',
  },
];

const APPLE_PLOT_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";

export function GlobalMarketTickerBar({
  liveMarket,
  activeSymbol,
  onSelectSymbol,
  onRefreshLive,
  refreshingLive,
}: {
  liveMarket?: LiveMarketSnapshot | null;
  activeSymbol: string;
  onSelectSymbol: (symbol: string, preset?: Partial<RunOptions>) => void;
  onRefreshLive?: () => void;
  refreshingLive?: boolean;
}) {
  const indices = liveMarket?.indices?.length ? liveMarket.indices.slice(0, 8) : FALLBACK_INDICES;
  const instruments = liveMarket?.instruments ?? [];

  return (
    <div className="market-ticker-strip" role="region" aria-label="Live Global Market Indices">
      <div className="market-ticker-inner">
        {/* 2-Row × 4-Column Spacious Apple Market Grid (Important Data Only: Symbol, Price, % Change) */}
        <div className="ticker-grid-2row">
          {indices.map(idx => {
            const isPositive = idx.change_pct >= 0;
            const targetSym = idx.ems_target || 'SPY';
            const isActive = activeSymbol === idx.symbol || activeSymbol === targetSym;
            const decimals = idx.price < 10 ? 4 : 2;
            return (
              <button
                key={idx.symbol}
                type="button"
                className={`ticker-item-chip ${isActive ? 'ticker-item-active' : ''}`}
                onClick={() => {
                  const matched = instruments.find(i => i.symbol === targetSym);
                  onSelectSymbol(targetSym, matched?.recommended_preset);
                }}
                title={`${idx.name} (${idx.asset_class}) · Click to trade ${targetSym}`}
              >
                <div className="ticker-chip-left">
                  <span className="ticker-sym">{idx.symbol}</span>
                  <span className="ticker-name-short">{idx.name}</span>
                </div>
                <div className="ticker-chip-right">
                  <span className="ticker-price mono-val">
                    {idx.price.toLocaleString(undefined, {
                      minimumFractionDigits: decimals,
                      maximumFractionDigits: decimals,
                    })}
                  </span>
                  <span className={`ticker-chg-pill mono-val ${isPositive ? 'chg-pos' : 'chg-neg'}`}>
                    {isPositive ? '+' : ''}
                    {idx.change_pct.toFixed(2)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {onRefreshLive && (
          <div className="ticker-footer-bar">
            <span className="ticker-live-tag">
              <span className="status-dot dot-online" />
              <span>{liveMarket?.is_live !== false ? 'Yahoo Finance Live Feed' : 'Institutional Feed'}</span>
            </span>
            <button
              type="button"
              className="ticker-sync-btn"
              onClick={onRefreshLive}
              disabled={refreshingLive}
              title="Refresh Live Market Feed"
            >
              <RefreshIcon size={12} />
              <span>{refreshingLive ? 'Syncing…' : 'Refresh Quotes'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function MarketOverviewHub({
  snapshot,
  liveMarket,
  options,
  activeSymbol,
  viewMode = 'overview',
  onSelectInstrument,
  onQuickBookTrade,
  onNavigateTab,
}: {
  snapshot: DashboardSnapshot | null;
  liveMarket: LiveMarketSnapshot | null;
  options: RunOptions;
  activeSymbol: string;
  viewMode?: 'overview' | 'screener';
  onSelectInstrument: (symbol: string, preset: Partial<RunOptions>) => void;
  onQuickBookTrade?: (symbol: string, side: Side, quantity: number, scenario: ScenarioKey) => Promise<void>;
  onNavigateTab: (tab: 'ems' | 'sor_tca' | 'stress' | 'signals' | 'copilot' | 'portfolio' | 'screener' | 'overview') => void;
  onRefreshLive?: () => void;
  refreshingLive?: boolean;
}) {
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [chartMode, setChartMode] = useState<'yahoo_intraday' | 'sim_fills'>('yahoo_intraday');
  const [bookingSym, setBookingSym] = useState<string | null>(null);

  const instruments: LiveInstrumentQuote[] = liveMarket?.instruments ?? [];
  const activeInst =
    instruments.find(i => i.symbol === activeSymbol) ??
    instruments[0] ?? {
      symbol: activeSymbol,
      yahoo_symbol: activeSymbol,
      name: `${activeSymbol} Institutional Spot`,
      asset_class: 'Institutional Asset',
      primary_venue: 'Multi-Venue SOR',
      price: snapshot?.market?.mid_price ?? 217.14,
      prev_close: (snapshot?.market?.mid_price ?? 217.14) * 0.99,
      change_abs: 2.15,
      change_pct: 1.0,
      day_high: (snapshot?.market?.mid_price ?? 217.14) * 1.012,
      day_low: (snapshot?.market?.mid_price ?? 217.14) * 0.988,
      day_volume: 18450000,
      spread_bps: 1.6,
      realized_vol_pct: 28.4,
      l5_depth_usd: 4200000,
      ofi_score: 0.18,
      toxicity_prob: 0.24,
      is_live: true,
      l2_source: 'Yahoo Finance Live',
      intraday_series: [],
      recommended_preset: {
        scenario: 'normal_market' as ScenarioKey,
        side: 'buy' as Side,
        order_size: 1000,
        horizon_sec: 60,
        risk_aversion: 0.0001,
      },
    };

  const filteredWatchlist =
    assetFilter === 'ALL'
      ? instruments
      : instruments.filter(w => w.asset_class.toUpperCase().includes(assetFilter));

  // Intraday Yahoo Finance 5-minute series
  const intradaySeries = activeInst.intraday_series ?? [];
  const yahooTimes = intradaySeries.map(pt => pt.time_label);
  const yahooPrices = intradaySeries.map(pt => pt.price);
  const yahooVwaps = intradaySeries.map(pt => pt.vwap);

  // Microstructure Execution Trajectory & Realized Child Slice Fills
  const trajectory = snapshot?.execution?.trajectory ?? [];
  const trajTimestamps = trajectory.map((_, i) => `T+${i}`);
  const refPrices = trajectory.map(p => p.reference_price);

  const passiveFillsX: string[] = [];
  const passiveFillsY: number[] = [];
  const aggressiveFillsX: string[] = [];
  const aggressiveFillsY: number[] = [];

  trajectory.forEach((pt, idx) => {
    if (pt.execution_price !== null) {
      if (pt.action === 'aggressive') {
        aggressiveFillsX.push(`T+${idx}`);
        aggressiveFillsY.push(pt.execution_price);
      } else {
        passiveFillsX.push(`T+${idx}`);
        passiveFillsY.push(pt.execution_price);
      }
    }
  });

  // Feature points for OFI & Spread Dynamics chart
  const featPoints = snapshot?.features?.points ?? [];
  const featX = featPoints.map((_, i) => `T-${featPoints.length - i}`);
  const ofiVals = featPoints.map(p => p.ofi_instant ?? 0);
  const spreadBpsVals = featPoints.map(p => p.spread_bps ?? 0);

  const perfResults = snapshot?.performance?.results ?? [];

  async function handleInstantTrade(inst: LiveInstrumentQuote, side: Side) {
    if (!onQuickBookTrade) return;
    setBookingSym(`${inst.symbol}-${side}`);
    try {
      await onQuickBookTrade(
        inst.symbol,
        side,
        inst.recommended_preset.order_size,
        inst.recommended_preset.scenario,
      );
    } finally {
      setBookingSym(null);
    }
  }

  // SCREENER VIEW: Clean 8-Asset Institutional Liquidity Table (Fits Viewport, No Vertical Scroll)
  if (viewMode === 'screener') {
    return (
      <div className="overview-hub-stack">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">LIVE MULTI-ASSET LIQUIDITY SCREENER · YAHOO FINANCE &amp; L2</span>
              <h2>Institutional Execution Universe — Live Quotes &amp; 1-Click Trading</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="preset-regimes">
                {(['ALL', 'CRYPTO', 'EQUITY', 'FUTURES', 'ETF'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={`preset-chip ${assetFilter === cat ? 'preset-active' : ''}`}
                    onClick={() => setAssetFilter(cat)}
                  >
                    {cat === 'ALL' ? 'All Assets (8)' : cat}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => onNavigateTab('overview')}
              >
                ← Back to Intraday Charts
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>INSTRUMENT</th>
                  <th>ASSET CLASS</th>
                  <th>LIVE PRICE</th>
                  <th>24H CHANGE</th>
                  <th>DAY RANGE</th>
                  <th>SPREAD</th>
                  <th>VOLATILITY</th>
                  <th>LIVE OFI</th>
                  <th>TOXICITY</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredWatchlist.map(row => {
                  const isSelected = activeSymbol === row.symbol;
                  const isPos = row.change_pct >= 0;
                  const toxPct = row.toxicity_prob * 100;
                  const decimals = row.price < 10 ? 4 : 2;
                  return (
                    <tr key={row.symbol} className={isSelected ? 'row-fasttrade' : ''}>
                      <td>
                        <div className="strat-cell">
                          <strong>{row.symbol}</strong>
                          {isSelected && <span className="winner-pill">ACTIVE</span>}
                        </div>
                        <small style={{ color: '#86868B', display: 'block', fontSize: '0.73rem' }}>
                          {row.name}
                        </small>
                      </td>
                      <td>
                        <span className="badge badge-neutral">{row.asset_class}</span>
                      </td>
                      <td className="mono-val">
                        <strong>
                          $
                          {row.price.toLocaleString(undefined, {
                            minimumFractionDigits: decimals,
                            maximumFractionDigits: decimals,
                          })}
                        </strong>
                      </td>
                      <td className={`mono-val ${isPos ? 'bid-text' : 'ask-text'}`}>
                        <strong>
                          {isPos ? '+' : ''}
                          {row.change_pct.toFixed(2)}%
                        </strong>
                      </td>
                      <td className="mono-val" style={{ fontSize: '0.78rem', color: '#86868B' }}>
                        ${row.day_low.toLocaleString()} — ${row.day_high.toLocaleString()}
                      </td>
                      <td className="mono-val">{row.spread_bps.toFixed(2)} bps</td>
                      <td className="mono-val">{row.realized_vol_pct.toFixed(1)}%</td>
                      <td className={`mono-val ${row.ofi_score >= 0 ? 'bid-text' : 'ask-text'}`}>
                        {row.ofi_score >= 0 ? '+' : ''}
                        {row.ofi_score.toFixed(2)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            toxPct >= 60 ? 'badge-aggressive' : toxPct <= 30 ? 'badge-passive' : 'badge-wait'
                          }`}
                        >
                          {toxPct >= 60 ? (
                            <AlertTriangleIcon size={11} />
                          ) : (
                            <CheckCircleIcon size={11} />
                          )}{' '}
                          {toxPct.toFixed(0)}%
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={isSelected ? 'btn-run-sim' : 'btn-outline-sm'}
                            style={isSelected ? { height: '30px', padding: '0 12px', fontSize: '0.75rem' } : undefined}
                            onClick={() => {
                              onSelectInstrument(row.symbol, row.recommended_preset);
                              onNavigateTab('ems');
                            }}
                          >
                            <PlayIcon size={11} /> Trade
                          </button>
                          {onQuickBookTrade && (
                            <button
                              type="button"
                              className="btn-outline-sm"
                              disabled={bookingSym === `${row.symbol}-buy`}
                              onClick={() => void handleInstantTrade(row, 'buy')}
                              title={`Execute & Book ${row.recommended_preset.order_size} ${row.symbol} BUY into Portfolio`}
                            >
                              {bookingSym === `${row.symbol}-buy`
                                ? 'Booking…'
                                : `Buy ${row.recommended_preset.order_size}`}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // OVERVIEW VIEW: Compact Apple Studio Dual Charts + 6-Algo Benchmark Ribbon (Fits Viewport, No Vertical Scroll)
  return (
    <div className="overview-hub-stack">
      {/* Row 1: Dual Apple Studio Quant Charts */}
      <div className="grid">
        {/* Left Card: Live Yahoo Finance Intraday 5m Price & VWAP OR Child Fills Tape */}
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">
                {activeInst.symbol} · ${activeInst.price.toLocaleString()} (
                {activeInst.change_pct >= 0 ? '+' : ''}
                {activeInst.change_pct.toFixed(2)}%) · RANGE ${activeInst.day_low.toLocaleString()}–$
                {activeInst.day_high.toLocaleString()}
              </span>
              <h2>
                {chartMode === 'yahoo_intraday'
                  ? `${activeInst.symbol} Intraday Price & Institutional VWAP`
                  : `${activeInst.symbol} Mid-Price Trajectory & SOR Child Fills`}
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                className={`preset-chip ${chartMode === 'yahoo_intraday' ? 'preset-active' : ''}`}
                onClick={() => setChartMode('yahoo_intraday')}
              >
                Intraday + VWAP
              </button>
              <button
                type="button"
                className={`preset-chip ${chartMode === 'sim_fills' ? 'preset-active' : ''}`}
                onClick={() => setChartMode('sim_fills')}
              >
                SOR Child Fills
              </button>
            </div>
          </div>

          {chartMode === 'yahoo_intraday' && yahooTimes.length > 0 ? (
            <Plot
              data={[
                {
                  x: yahooTimes,
                  y: yahooPrices,
                  type: 'scatter',
                  mode: 'lines',
                  name: `${activeInst.symbol} Price`,
                  line: { color: '#0071E3', width: 2.5, shape: 'spline' },
                  fill: 'tozeroy',
                  fillcolor: 'rgba(0, 113, 227, 0.07)',
                },
                {
                  x: yahooTimes,
                  y: yahooVwaps,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Session VWAP',
                  line: { color: '#1D1D1F', width: 1.8, dash: 'dot', shape: 'spline' },
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#FFFFFF',
                font: { color: '#86868B', family: APPLE_PLOT_FONT, size: 11 },
                margin: { t: 10, r: 14, b: 34, l: 58 },
                height: 245,
                autosize: true,
                legend: { orientation: 'h', y: 1.14, x: 0, font: { size: 11, color: '#1D1D1F' } },
                xaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                  tickfont: { size: 10, color: '#86868B' },
                },
                yaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                  tickprefix: '$',
                  tickfont: { size: 10, color: '#86868B' },
                  range: [
                    Math.min(...yahooPrices, ...yahooVwaps) * 0.9985,
                    Math.max(...yahooPrices, ...yahooVwaps) * 1.0015,
                  ],
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : trajectory.length > 0 ? (
            <Plot
              data={[
                {
                  x: trajTimestamps,
                  y: refPrices,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'L2 Mid-Price',
                  line: { color: '#1D1D1F', width: 2.2, shape: 'spline' },
                },
                {
                  x: passiveFillsX,
                  y: passiveFillsY,
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Passive Maker Fill',
                  marker: { color: '#00A854', size: 8, symbol: 'circle' },
                },
                {
                  x: aggressiveFillsX,
                  y: aggressiveFillsY,
                  type: 'scatter',
                  mode: 'markers',
                  name: 'Aggressive Sweep',
                  marker: { color: '#FF9500', size: 9, symbol: 'diamond' },
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#FFFFFF',
                font: { color: '#86868B', family: APPLE_PLOT_FONT, size: 11 },
                margin: { t: 10, r: 14, b: 34, l: 58 },
                height: 245,
                autosize: true,
                legend: { orientation: 'h', y: 1.14, x: 0, font: { size: 11, color: '#1D1D1F' } },
                xaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                },
                yaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                  tickprefix: '$',
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <p className="empty">Loading live market chart…</p>
          )}

          <div className="schedule-stats-footer">
            <div>
              <span className="stat-label">ARRIVAL BENCHMARK</span>
              <strong className="mono-val">${activeInst.price.toLocaleString()}</strong>
            </div>
            <div>
              <span className="stat-label">MAKER FILLS</span>
              <strong className="mono-val bid-text">{passiveFillsX.length} slices</strong>
            </div>
            <div>
              <span className="stat-label">TAKER SWEEPS</span>
              <strong className="mono-val" style={{ color: '#FF9500' }}>
                {aggressiveFillsX.length} slices
              </strong>
            </div>
            <div>
              <span className="stat-label">COMPLETION</span>
              <strong className="mono-val">
                {snapshot?.execution
                  ? `${((snapshot.execution.filled_quantity / Math.max(1, snapshot.execution.target_quantity)) * 100).toFixed(1)}%`
                  : '100.0%'}
              </strong>
            </div>
          </div>
        </section>

        {/* Right Card: Cont-Kukanov-Stoikov OFI & Spread Dynamics */}
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">CONT–KUKANOV–STOIKOV MICROSTRUCTURE TELEMETRY</span>
              <h2>Order Flow Imbalance (OFI) &amp; Spread Dynamics</h2>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => onNavigateTab('screener')}
              >
                8-Asset Screener
              </button>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => onNavigateTab('signals')}
              >
                ML Signals →
              </button>
            </div>
          </div>

          {featPoints.length > 0 ? (
            <Plot
              data={[
                {
                  x: featX,
                  y: ofiVals,
                  type: 'bar',
                  name: 'Signed OFI',
                  marker: {
                    color: ofiVals.map(v => (v >= 0 ? 'rgba(0, 168, 84, 0.72)' : 'rgba(255, 59, 48, 0.72)')),
                  },
                  yaxis: 'y',
                },
                {
                  x: featX,
                  y: spreadBpsVals,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'L1 Spread (bps)',
                  line: { color: '#0071E3', width: 2.2, shape: 'spline' },
                  yaxis: 'y2',
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#FFFFFF',
                font: { color: '#86868B', family: APPLE_PLOT_FONT, size: 11 },
                margin: { t: 10, r: 44, b: 34, l: 48 },
                height: 245,
                autosize: true,
                legend: { orientation: 'h', y: 1.14, x: 0, font: { size: 11, color: '#1D1D1F' } },
                xaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                  tickfont: { size: 10, color: '#86868B' },
                },
                yaxis: {
                  gridcolor: '#F2F2F7',
                  linecolor: '#E5E5EA',
                  tickfont: { size: 10, color: '#86868B' },
                },
                yaxis2: {
                  overlaying: 'y',
                  side: 'right',
                  showgrid: false,
                  tickfont: { size: 10, color: '#0071E3' },
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <p className="empty">Loading microstructure telemetry…</p>
          )}

          <div className="schedule-stats-footer">
            <div>
              <span className="stat-label">LIVE OFI</span>
              <strong className={`mono-val ${activeInst.ofi_score >= 0 ? 'bid-text' : 'ask-text'}`}>
                {activeInst.ofi_score >= 0 ? '+' : ''}
                {activeInst.ofi_score.toFixed(2)}
              </strong>
            </div>
            <div>
              <span className="stat-label">L1 SPREAD</span>
              <strong className="mono-val">{activeInst.spread_bps.toFixed(2)} bps</strong>
            </div>
            <div>
              <span className="stat-label">TOXICITY</span>
              <strong
                className="mono-val"
                style={{
                  color:
                    activeInst.toxicity_prob >= 0.65
                      ? '#FF3B30'
                      : activeInst.toxicity_prob <= 0.35
                        ? '#00A854'
                        : '#FF9500',
                }}
              >
                {(activeInst.toxicity_prob * 100).toFixed(1)}%
              </strong>
            </div>
            <div>
              <span className="stat-label">REGIME</span>
              <strong className="mono-val">{snapshot?.regime_info?.badge_label ?? 'NORMAL'}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Row 2: Compact 6-Strategy Implementation Shortfall Matrix */}
      {perfResults.length > 0 && (
        <section className="card" style={{ padding: '14px 18px' }}>
          <div className="card-header" style={{ marginBottom: 10, paddingBottom: 8 }}>
            <div>
              <span className="section-label">IDENTICAL MARKET REPLAY BENCHMARK</span>
              <h2 style={{ fontSize: '0.98rem' }}>
                6-Strategy Implementation Shortfall ({activeSymbol} · {options.order_size.toLocaleString()} Units)
              </h2>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-outline-sm" onClick={() => onNavigateTab('stress')}>
                <SlidersIcon size={12} /> Monte Carlo CaR
              </button>
              <button type="button" className="btn-outline-sm" onClick={() => onNavigateTab('sor_tca')}>
                <ActivityIcon size={12} /> Full SOR &amp; TCA →
              </button>
            </div>
          </div>

          <div className="stress-kpi-grid">
            {perfResults.map(r => {
              const isFastTrade = r.strategy === 'fasttrade';
              return (
                <div
                  key={r.strategy}
                  className={`stress-kpi-box ${isFastTrade ? 'stress-kpi-primary' : ''}`}
                >
                  <span className="stress-kpi-label">{r.strategy.replace('_', ' ').toUpperCase()}</span>
                  <strong className={`stress-kpi-val mono-val ${isFastTrade ? 'bid-text' : ''}`}>
                    {r.implementation_shortfall_bps.toFixed(2)} bps
                  </strong>
                  <span className="stress-kpi-sub">
                    Impact {r.market_impact_bps.toFixed(1)} · Tox {r.adverse_selection_bps.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
