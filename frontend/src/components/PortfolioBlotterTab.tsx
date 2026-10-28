import { useState } from 'react';
import Plot from 'react-plotly.js';
import type {
  DashboardSnapshot,
  LiveMarketSnapshot,
  PortfolioAndBlotterResponse,
  ScenarioKey,
  Side,
} from '../types';
import { executePortfolioTrade, resetPortfolio } from '../api';
import {
  ActivityIcon,
  CheckCircleIcon,
  DownloadIcon,
  PlayIcon,
  RefreshIcon,
} from './Icons';

export function PortfolioBlotterTab({
  portfolioData,
  liveMarket,
  userEmail,
  activeSubTab = 'positions',
  onPortfolioUpdated,
  onRefreshPortfolio,
  refreshing,
}: {
  portfolioData: PortfolioAndBlotterResponse | null;
  liveMarket: LiveMarketSnapshot | null;
  userEmail?: string;
  activeSubTab?: 'positions' | 'blotter';
  onPortfolioUpdated: (nextPortfolio: PortfolioAndBlotterResponse, nextSnapshot?: DashboardSnapshot) => void;
  onRefreshPortfolio: () => void;
  refreshing?: boolean;
}) {
  const [ticketSymbol, setTicketSymbol] = useState<string>('NVDA');
  const [ticketSide, setTicketSide] = useState<Side>('buy');
  const [ticketQty, setTicketQty] = useState<number>(500);
  const [ticketScenario, setTicketScenario] = useState<ScenarioKey>('normal_market');
  const [ticketHorizon, setTicketHorizon] = useState<number>(60);
  const [executingOrder, setExecutingOrder] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [blotterFilter, setBlotterFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const summary = portfolioData?.summary;
  const positions = portfolioData?.positions ?? [];
  const trades = portfolioData?.trades ?? [];
  const instruments = liveMarket?.instruments ?? [];

  const selectedLiveInst = instruments.find(i => i.symbol === ticketSymbol);
  const estLivePrice = selectedLiveInst?.price ?? 217.14;
  const estNotionalUsd = estLivePrice * ticketQty;

  const filteredTrades =
    blotterFilter === 'ALL'
      ? trades
      : trades.filter(t => t.side.toUpperCase() === blotterFilter);

  async function handleExecuteDirectOrder(e: React.FormEvent) {
    e.preventDefault();
    setExecutingOrder(true);
    setBannerMsg(null);
    try {
      const res = await executePortfolioTrade({
        symbol: ticketSymbol,
        side: ticketSide,
        quantity: ticketQty,
        scenario: ticketScenario,
        horizon_sec: ticketHorizon,
        user_email: userEmail || 'trader@fasttrade.ai',
      });
      onPortfolioUpdated(res.portfolio, res.snapshot);
      setBannerMsg(
        `Executed & Booked ${res.trade.trade_id}: ${res.trade.side.toUpperCase()} ${res.trade.quantity.toLocaleString()} ${res.trade.symbol} @ $${res.trade.avg_fill_price.toLocaleString()} ($${res.trade.notional_usd.toLocaleString()} Notional · IS: ${res.trade.shortfall_bps.toFixed(2)} bps · Alpha Saved: +$${res.trade.alpha_saved_usd.toLocaleString()})`,
      );
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Order execution failed');
    } finally {
      setExecutingOrder(false);
    }
  }

  async function handleQuickPositionAction(symbol: string, side: Side, qty: number) {
    setExecutingOrder(true);
    setBannerMsg(null);
    try {
      const res = await executePortfolioTrade({
        symbol,
        side,
        quantity: Math.max(1, Math.round(qty)),
        scenario: 'normal_market',
        horizon_sec: 60,
        user_email: userEmail || 'trader@fasttrade.ai',
      });
      onPortfolioUpdated(res.portfolio, res.snapshot);
      setBannerMsg(
        `Position Updated (${res.trade.trade_id}): ${side.toUpperCase()} ${res.trade.quantity.toLocaleString()} ${symbol} @ $${res.trade.avg_fill_price.toLocaleString()}`,
      );
    } finally {
      setExecutingOrder(false);
    }
  }

  async function handleResetDemoBook() {
    setResetting(true);
    setBannerMsg(null);
    try {
      const next = await resetPortfolio(userEmail || 'trader@fasttrade.ai');
      onPortfolioUpdated(next);
      setBannerMsg(
        `Institutional Portfolio & Trade Blotter for ${userEmail || 'trader@fasttrade.ai'} reset to baseline $25.0M multi-asset book.`,
      );
    } finally {
      setResetting(false);
    }
  }

  function exportBlotterCsv() {
    if (!trades.length) return;
    const headers = [
      'Trade ID',
      'Order ID',
      'Executed At (UTC)',
      'Symbol',
      'Asset Class',
      'Side',
      'Quantity',
      'Arrival Price ($)',
      'Avg Fill Price ($)',
      'Notional ($ USD)',
      'Shortfall (bps)',
      'TWAP Shortfall (bps)',
      'Alpha Saved ($ USD)',
      'Venue Routing Split',
      'Scenario',
      'Status',
    ];
    const rows = trades.map(t => [
      t.trade_id,
      t.order_id,
      t.executed_at,
      t.symbol,
      `"${t.asset_class}"`,
      t.side.toUpperCase(),
      t.quantity,
      t.arrival_price,
      t.avg_fill_price,
      t.notional_usd,
      t.shortfall_bps,
      t.twap_shortfall_bps,
      t.alpha_saved_usd,
      `"${t.venue_summary}"`,
      t.scenario,
      t.status,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FastTrade_Institutional_Blotter_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const openPositions = positions.filter(p => Math.abs(p.net_quantity) > 1e-9);

  return (
    <div className="overview-hub-stack">
      {/* Portfolio Executive KPI Ribbon */}
      {summary && (
        <section className="kpi-ribbon">
          <div className="kpi-card kpi-highlight">
            <span className="kpi-label">DESK NET ASSET VALUE (LIVE NAV)</span>
            <strong className="kpi-value mono-val">
              ${summary.total_nav_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="kpi-sub">
              Account: <strong>{summary.account_owner_email || userEmail || 'trader@fasttrade.ai'}</strong> · Cash:{' '}
              <strong>${(summary.cash_balance_usd / 1_000_000).toFixed(2)}M</strong>
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">TOTAL MARK-TO-MARKET P&amp;L</span>
            <strong className={`kpi-value mono-val ${summary.total_pnl_usd >= 0 ? 'bid-text' : 'ask-text'}`}>
              {summary.total_pnl_usd >= 0 ? '+' : ''}$
              {summary.total_pnl_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="kpi-sub">
              Unrealized: <strong>${summary.total_unrealized_pnl_usd.toLocaleString()}</strong> · Realized:{' '}
              <strong>${summary.total_realized_pnl_usd.toLocaleString()}</strong>
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">GROSS / NET MARKET EXPOSURE</span>
            <strong className="kpi-value mono-val">
              ${(summary.gross_exposure_usd / 1_000_000).toFixed(2)}M
            </strong>
            <span className="kpi-sub">
              Net Exposure: <strong>${(summary.net_exposure_usd / 1_000_000).toFixed(2)}M</strong> · Open Positions:{' '}
              <strong>{summary.open_positions_count}</strong>
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">CUMULATIVE SOR ALPHA SAVED</span>
            <strong className="kpi-value mono-val bid-text">
              +${summary.cumulative_alpha_saved_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
            <span className="kpi-sub">
              Avg Shortfall: <strong>{summary.avg_shortfall_bps.toFixed(2)} bps</strong> vs TWAP Benchmark
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">EXECUTED BLOTTER VOLUME</span>
            <strong className="kpi-value mono-val">
              ${(summary.total_traded_volume_usd / 1_000_000).toFixed(2)}M
            </strong>
            <span className="kpi-sub">
              Filled Parent Orders: <strong>{summary.total_trades_count}</strong> · Feed:{' '}
              <strong>Yahoo Finance Live</strong>
            </span>
          </div>
        </section>
      )}

      {bannerMsg && (
        <div className="profile-success-banner">
          <CheckCircleIcon size={16} />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* Direct Live Institutional Order Execution Ticket */}
      <section className="control-deck">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span className="toolbar-label">
            <ActivityIcon size={13} /> DIRECT INSTITUTIONAL SOR ORDER TICKET (ANCHORED TO LIVE YAHOO FINANCE QUOTES)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={onRefreshPortfolio}
              disabled={refreshing}
            >
              <RefreshIcon size={13} /> {refreshing ? 'Marking to Market…' : 'Refresh Live Mark-to-Market'}
            </button>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => void handleResetDemoBook()}
              disabled={resetting}
            >
              {resetting ? 'Resetting…' : 'Reset Demo Book ($25M)'}
            </button>
          </div>
        </div>

        <form className="run-controls" onSubmit={e => void handleExecuteDirectOrder(e)}>
          <label className="control-field">
            <span>INSTRUMENT (LIVE FEED)</span>
            <select value={ticketSymbol} onChange={e => setTicketSymbol(e.target.value)}>
              {(instruments.length
                ? instruments
                : [
                    { symbol: 'NVDA', name: 'NVIDIA Corp', price: 217.14 },
                    { symbol: 'BTC-USD', name: 'Bitcoin Spot', price: 80834.55 },
                    { symbol: 'SPY', name: 'S&P 500 ETF', price: 770.83 },
                    { symbol: 'AAPL', name: 'Apple Inc', price: 344.67 },
                    { symbol: 'MSFT', name: 'Microsoft Corp', price: 528.18 },
                    { symbol: 'ETH-USD', name: 'Ethereum Spot', price: 2344.22 },
                    { symbol: 'ES-FUT', name: 'E-Mini S&P 500', price: 7761.25 },
                    { symbol: 'NQ-FUT', name: 'E-Mini NASDAQ-100', price: 29813.25 },
                  ]
              ).map(inst => (
                <option key={inst.symbol} value={inst.symbol}>
                  {inst.symbol} — ${inst.price.toLocaleString()} ({inst.name})
                </option>
              ))}
            </select>
          </label>

          <label className="control-field">
            <span>ORDER SIDE</span>
            <select value={ticketSide} onChange={e => setTicketSide(e.target.value as Side)}>
              <option value="buy">BUY (Accumulate / Long)</option>
              <option value="sell">SELL (Liquidate / Short)</option>
            </select>
          </label>

          <label className="control-field">
            <span>QUANTITY (UNITS)</span>
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              required
              value={ticketQty}
              onChange={e => setTicketQty(Number(e.target.value))}
            />
          </label>

          <label className="control-field">
            <span>EXECUTION REGIME</span>
            <select
              value={ticketScenario}
              onChange={e => setTicketScenario(e.target.value as ScenarioKey)}
            >
              <option value="normal_market">Normal Market (Balanced Liquidity)</option>
              <option value="high_adverse_selection">High Adverse Selection (Toxic Flow)</option>
              <option value="high_volatility">High Volatility (Jump Diffusion)</option>
              <option value="poor_liquidity">Poor Liquidity (Thin L2 Book)</option>
              <option value="low_adverse_selection">Low Adverse Selection (Passive Maker)</option>
            </select>
          </label>

          <label className="control-field">
            <span>HORIZON (SEC)</span>
            <input
              type="number"
              min={10}
              max={300}
              value={ticketHorizon}
              onChange={e => setTicketHorizon(Number(e.target.value))}
            />
          </label>

          <button type="submit" className="btn-run-sim" disabled={executingOrder}>
            <PlayIcon size={14} />{' '}
            {executingOrder
              ? 'Routing & Booking…'
              : `Execute & Book ($${(estNotionalUsd / 1000).toFixed(1)}k)`}
          </button>
        </form>
      </section>

      {/* Dual Portfolio Analytics Charts */}
      <div className="grid">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">PORTFOLIO EXPOSURE &amp; P&amp;L ATTRIBUTION</span>
              <h2>Open Position Market Value ($ USD) &amp; Total P&amp;L by Asset</h2>
            </div>
          </div>

          {openPositions.length > 0 ? (
            <Plot
              data={[
                {
                  x: openPositions.map(p => p.symbol),
                  y: openPositions.map(p => p.market_value_usd),
                  type: 'bar',
                  name: 'Live Market Value ($ USD)',
                  marker: { color: '#0A0A0A' },
                  yaxis: 'y',
                },
                {
                  x: openPositions.map(p => p.symbol),
                  y: openPositions.map(p => p.total_pnl_usd),
                  type: 'bar',
                  name: 'Total Position P&L ($ USD)',
                  marker: {
                    color: openPositions.map(p => (p.total_pnl_usd >= 0 ? '#10B981' : '#EF4444')),
                  },
                  yaxis: 'y2',
                },
              ]}
              layout={{
                barmode: 'group',
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#FAFAFA',
                font: { color: '#6B6B6B', family: 'DM Sans, sans-serif', size: 11 },
                margin: { t: 16, r: 56, b: 40, l: 64 },
                height: 270,
                autosize: true,
                legend: { orientation: 'h', y: 1.14, x: 0 },
                xaxis: { gridcolor: '#E8E8EC' },
                yaxis: { title: { text: 'Exposure ($ USD)' }, gridcolor: '#E8E8EC' },
                yaxis2: {
                  title: { text: 'P&L ($ USD)' },
                  overlaying: 'y',
                  side: 'right',
                  showgrid: false,
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <p className="empty">No open positions in portfolio.</p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <span className="section-label">TRANSACTION COST ANALYSIS (TCA) SAVINGS LEDGER</span>
              <h2>Execution Alpha Preserved vs. TWAP Benchmark ($ USD per Trade)</h2>
            </div>
          </div>

          {trades.length > 0 ? (
            <Plot
              data={[
                {
                  x: trades.slice(0, 12).reverse().map(t => `${t.symbol} (${t.trade_id.slice(-3)})`),
                  y: trades.slice(0, 12).reverse().map(t => t.alpha_saved_usd),
                  type: 'bar',
                  name: 'Alpha Saved vs TWAP ($ USD)',
                  marker: { color: '#6366F1' },
                },
              ]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#FAFAFA',
                font: { color: '#6B6B6B', family: 'DM Sans, sans-serif', size: 11 },
                margin: { t: 16, r: 20, b: 56, l: 60 },
                height: 270,
                autosize: true,
                xaxis: { gridcolor: '#E8E8EC', tickangle: -20 },
                yaxis: { title: { text: 'Alpha Saved ($ USD)' }, gridcolor: '#E8E8EC' },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%' }}
            />
          ) : (
            <p className="empty">No trades recorded yet.</p>
          )}
        </section>
      </div>

      {/* Open Positions Table (Live Mark-to-Market) */}
      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">
              REAL-TIME POSITION BOOK · MARKED TO MARKET AGAINST YAHOO FINANCE LIVE QUOTES
            </span>
            <h2>Institutional Portfolio Holdings &amp; Live P&amp;L Attribution</h2>
          </div>
          <span className="badge badge-passive">
            {openPositions.length} ACTIVE POSITIONS · LIVE MTM
          </span>
        </div>

        <div className="table-scroll">
          <table className="perf-table">
            <thead>
              <tr>
                <th>INSTRUMENT</th>
                <th>SIDE</th>
                <th>NET QUANTITY</th>
                <th>AVG ENTRY ($)</th>
                <th>LIVE PRICE (24H)</th>
                <th>MARKET VALUE ($)</th>
                <th>WEIGHT</th>
                <th>UNREALIZED P&amp;L</th>
                <th>REALIZED P&amp;L</th>
                <th>SOR ALPHA SAVED</th>
                <th>DESK ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {positions.map(pos => {
                const isUp = pos.unrealized_pnl_usd >= 0;
                const decimals = pos.live_price < 10 ? 4 : 2;
                return (
                  <tr key={pos.symbol}>
                    <td>
                      <strong>{pos.symbol}</strong>
                      <small style={{ display: 'block', color: '#6B6B6B', fontSize: '0.72rem' }}>
                        {pos.name} · {pos.asset_class}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          pos.side === 'LONG'
                            ? 'badge-passive'
                            : pos.side === 'SHORT'
                              ? 'badge-aggressive'
                              : 'badge-neutral'
                        }`}
                      >
                        {pos.side}
                      </span>
                    </td>
                    <td className="mono-val">
                      <strong>{pos.net_quantity.toLocaleString()}</strong>
                    </td>
                    <td className="mono-val">
                      ${pos.avg_entry_price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                    </td>
                    <td className="mono-val">
                      <strong>
                        ${pos.live_price.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
                      </strong>{' '}
                      <span className={pos.day_change_pct >= 0 ? 'bid-text' : 'ask-text'} style={{ fontSize: '0.75rem' }}>
                        ({pos.day_change_pct >= 0 ? '+' : ''}
                        {pos.day_change_pct.toFixed(2)}%)
                      </span>
                    </td>
                    <td className="mono-val">
                      <strong>${pos.market_value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </td>
                    <td className="mono-val">{pos.weight_pct.toFixed(1)}%</td>
                    <td className={`mono-val ${isUp ? 'bid-text' : 'ask-text'}`}>
                      <strong>
                        {isUp ? '+' : ''}${pos.unrealized_pnl_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>{' '}
                      <span style={{ fontSize: '0.74rem' }}>
                        ({isUp ? '+' : ''}
                        {pos.unrealized_pnl_pct.toFixed(2)}%)
                      </span>
                    </td>
                    <td className={`mono-val ${pos.realized_pnl_usd >= 0 ? 'bid-text' : 'ask-text'}`}>
                      {pos.realized_pnl_usd >= 0 ? '+' : ''}$
                      {pos.realized_pnl_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="mono-val bid-text">
                      +${pos.alpha_saved_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          disabled={executingOrder}
                          onClick={() =>
                            void handleQuickPositionAction(
                              pos.symbol,
                              'buy',
                              Math.max(10, Math.round(Math.abs(pos.net_quantity) * 0.25)),
                            )
                          }
                        >
                          +25%
                        </button>
                        {Math.abs(pos.net_quantity) > 0 && (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            disabled={executingOrder}
                            onClick={() =>
                              void handleQuickPositionAction(
                                pos.symbol,
                                pos.net_quantity > 0 ? 'sell' : 'buy',
                                Math.max(1, Math.round(Math.abs(pos.net_quantity) * 0.5)),
                              )
                            }
                          >
                            Reduce 50%
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

      {/* Institutional Execution Trade Blotter (Full Transaction History) */}
      <section className="card">
        <div className="card-header">
          <div>
            <span className="section-label">
              IMMUTABLE EXECUTION BLOTTER · SELF-HOSTED POSTGRESQL &amp; LOCAL LEDGER
            </span>
            <h2>Executed Parent Orders, Multi-Venue Fills &amp; Implementation Shortfall Audit</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['ALL', 'BUY', 'SELL'] as const).map(f => (
              <button
                key={f}
                type="button"
                className={`preset-chip ${blotterFilter === f ? 'preset-active' : ''}`}
                onClick={() => setBlotterFilter(f)}
              >
                {f === 'ALL' ? `All Executions (${trades.length})` : `${f} Orders`}
              </button>
            ))}
            <button type="button" className="btn-outline-sm" onClick={exportBlotterCsv}>
              <DownloadIcon size={13} /> Export Blotter .CSV
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="perf-table">
            <thead>
              <tr>
                <th>TRADE ID / ORDER ID</th>
                <th>EXECUTED AT (UTC)</th>
                <th>SYMBOL</th>
                <th>SIDE</th>
                <th>QTY FILLED</th>
                <th>ARRIVAL PRICE</th>
                <th>SOR FILL VWAP</th>
                <th>NOTIONAL ($ USD)</th>
                <th>SHORTFALL (IS)</th>
                <th>TWAP BENCHMARK</th>
                <th>ALPHA SAVED</th>
                <th>MULTI-VENUE ROUTING SPLIT</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map(tr => {
                const isBuy = tr.side.toLowerCase() === 'buy';
                return (
                  <tr key={tr.trade_id}>
                    <td className="mono-val">
                      <strong>{tr.trade_id}</strong>
                      <small style={{ display: 'block', color: '#6B6B6B', fontSize: '0.7rem' }}>
                        {tr.order_id}
                      </small>
                    </td>
                    <td className="mono-val" style={{ fontSize: '0.76rem', color: '#52525B' }}>
                      {new Date(tr.executed_at).toLocaleString()}
                    </td>
                    <td>
                      <strong>{tr.symbol}</strong>
                      <small style={{ display: 'block', color: '#6B6B6B', fontSize: '0.7rem' }}>
                        {tr.asset_class}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${isBuy ? 'badge-passive' : 'badge-aggressive'}`}>
                        {tr.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono-val">
                      <strong>{tr.quantity.toLocaleString()}</strong>
                    </td>
                    <td className="mono-val">${tr.arrival_price.toLocaleString()}</td>
                    <td className="mono-val">
                      <strong>${tr.avg_fill_price.toLocaleString()}</strong>
                    </td>
                    <td className="mono-val">
                      <strong>${tr.notional_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </td>
                    <td className="mono-val bid-text">
                      <strong>{tr.shortfall_bps.toFixed(2)} bps</strong>
                    </td>
                    <td className="mono-val">{tr.twap_shortfall_bps.toFixed(2)} bps</td>
                    <td className="mono-val bid-text">
                      <strong>+${tr.alpha_saved_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </td>
                    <td style={{ fontSize: '0.76rem', color: '#52525B' }}>{tr.venue_summary}</td>
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
