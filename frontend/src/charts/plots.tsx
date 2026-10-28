import Plot from 'react-plotly.js';
import type { ACSchedulePoint, ExecutionPoint, FeaturePoint, ForecastPoint, RiskPoint, StrategyResult } from '../types';

const APPLE_FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif";
const APPLE_MONO = "'SF Mono', 'JetBrains Mono', monospace";

const baseLayout = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: '#FFFFFF',
  font: { color: '#86868B', family: APPLE_FONT, size: 11.5 },
  margin: { t: 16, r: 14, b: 36, l: 52 },
  autosize: true,
  xaxis: {
    gridcolor: '#F2F2F7',
    linecolor: '#E5E5EA',
    zerolinecolor: '#E5E5EA',
    tickfont: { size: 10.5, color: '#86868B', family: APPLE_MONO },
  },
  yaxis: {
    gridcolor: '#F2F2F7',
    linecolor: '#E5E5EA',
    zerolinecolor: '#E5E5EA',
    tickfont: { size: 10.5, color: '#86868B', family: APPLE_MONO },
  },
};

export function ExecutionTrajectory({ points }: { points: ExecutionPoint[] }) {
  const x = points.map(p => p.timestamp);
  return (
    <Plot
      data={[
        {
          x,
          y: points.map(p => p.remaining_quantity),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Remaining Inventory',
          line: { color: '#0071E3', width: 2.5, shape: 'spline' },
          marker: { size: 5, color: '#0071E3' },
          fill: 'tozeroy',
          fillcolor: 'rgba(0, 113, 227, 0.07)',
        },
        {
          x,
          y: points.map(p => p.filled_quantity),
          type: 'scatter',
          mode: 'lines',
          name: 'Cumulative Filled',
          line: { color: '#00A854', width: 2, dash: 'dot', shape: 'spline' },
        },
      ]}
      layout={{
        ...baseLayout,
        xaxis: { ...baseLayout.xaxis, title: { text: 'Simulation Timeline (UTC)', font: { size: 11, color: '#86868B' } } },
        yaxis: { ...baseLayout.yaxis, title: { text: 'Quantity (Units)', font: { size: 11, color: '#86868B' } } },
        legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 11, color: '#1D1D1F' } },
      }}
      useResizeHandler
      style={{ width: '100%', height: 235 }}
      config={{ displayModeBar: false }}
    />
  );
}

export function ExecutionActions({ points }: { points: ExecutionPoint[] }) {
  const colors = points.map(p =>
    p.action === 'aggressive' ? '#FF3B30' : p.action === 'passive' ? '#00A854' : '#FF9500',
  );
  return (
    <Plot
      data={[
        {
          x: points.map(p => p.timestamp),
          y: points.map(p => p.action),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'SOR Action',
          line: { color: '#C7C7CC', width: 1.5, shape: 'hv' },
          marker: { size: 8, color: colors, line: { color: '#FFFFFF', width: 1.5 } },
        },
      ]}
      layout={{
        ...baseLayout,
        margin: { t: 10, r: 14, b: 34, l: 78 },
        xaxis: { ...baseLayout.xaxis, title: { text: 'Time', font: { size: 11, color: '#86868B' } } },
        yaxis: {
          ...baseLayout.yaxis,
          title: { text: 'Mode', font: { size: 11, color: '#86868B' } },
          categoryorder: 'array',
          categoryarray: ['wait', 'passive', 'aggressive'],
        },
        showlegend: false,
      }}
      useResizeHandler
      style={{ width: '100%', height: 175 }}
      config={{ displayModeBar: false }}
    />
  );
}

export function RiskHistoryChart({ points }: { points: RiskPoint[] }) {
  const x = points.map(p => p.timestamp);
  return (
    <Plot
      data={[
        {
          x,
          y: points.map(p => p.adverse_selection_probability * 100),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Toxicity Risk (%)',
          line: { color: '#0071E3', width: 2.3, shape: 'spline' },
          marker: {
            size: 6,
            color: points.map(p =>
              p.adverse_selection_probability >= 0.65
                ? '#FF3B30'
                : p.adverse_selection_probability <= 0.35
                  ? '#00A854'
                  : '#FF9500',
            ),
          },
          fill: 'tozeroy',
          fillcolor: 'rgba(0, 113, 227, 0.06)',
        },
        {
          x,
          y: x.map(() => 65),
          type: 'scatter',
          mode: 'lines',
          name: 'Withdraw Gate (65%)',
          line: { color: '#FF3B30', width: 1.2, dash: 'dash' },
        },
        {
          x,
          y: x.map(() => 35),
          type: 'scatter',
          mode: 'lines',
          name: 'Safe Maker (35%)',
          line: { color: '#00A854', width: 1.2, dash: 'dot' },
        },
      ]}
      layout={{
        ...baseLayout,
        margin: { t: 20, r: 14, b: 34, l: 48 },
        xaxis: { ...baseLayout.xaxis, title: { text: 'Time', font: { size: 11, color: '#86868B' } } },
        yaxis: { ...baseLayout.yaxis, title: { text: 'Probability (%)', font: { size: 11, color: '#86868B' } }, range: [0, 100] },
        legend: { orientation: 'h', y: 1.16, x: 0, font: { size: 11, color: '#1D1D1F' } },
      }}
      useResizeHandler
      style={{ width: '100%', height: 225 }}
      config={{ displayModeBar: false }}
    />
  );
}

export function ForecastChart({ points }: { points: ForecastPoint[] }) {
  const x = points.map(p => p.timestamp);
  return (
    <Plot
      data={[
        {
          x,
          y: points.map(p => (p.valid ? p.expected_move_bps : null)),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Expected Return (bps)',
          line: { color: '#0071E3', width: 2.3, shape: 'spline' },
          marker: {
            size: 6,
            color: points.map(p => ((p.expected_move_bps ?? 0) >= 0 ? '#00A854' : '#FF3B30')),
          },
          connectgaps: false,
        },
      ]}
      layout={{
        ...baseLayout,
        margin: { t: 14, r: 14, b: 34, l: 52 },
        xaxis: { ...baseLayout.xaxis, title: { text: 'Time', font: { size: 11, color: '#86868B' } } },
        yaxis: { ...baseLayout.yaxis, title: { text: 'Forecast Move (bps)', font: { size: 11, color: '#86868B' } } },
        showlegend: false,
      }}
      useResizeHandler
      style={{ width: '100%', height: 225 }}
      config={{ displayModeBar: false }}
    />
  );
}

export function ACScheduleChart({ points }: { points: ACSchedulePoint[] }) {
  return (
    <Plot
      data={[
        {
          x: points.map(p => p.elapsed_sec),
          y: points.map(p => p.planned_remaining_quantity),
          type: 'scatter',
          mode: 'lines+markers',
          name: 'AC Planned Inventory',
          line: { color: '#0071E3', width: 2.5, shape: 'spline' },
          marker: { size: 6, color: '#0071E3' },
        },
        {
          x: points.slice(0, -1).map(p => p.elapsed_sec),
          y: points.slice(0, -1).map(p => p.planned_slice_quantity),
          type: 'bar',
          name: 'Optimal Slice Size',
          marker: { color: 'rgba(0, 168, 84, 0.24)', line: { color: '#00A854', width: 1.2 } },
        },
      ]}
      layout={{
        ...baseLayout,
        margin: { t: 20, r: 14, b: 38, l: 56 },
        xaxis: { ...baseLayout.xaxis, title: { text: 'Elapsed Execution Horizon (sec)', font: { size: 11, color: '#86868B' } } },
        yaxis: { ...baseLayout.yaxis, title: { text: 'Quantity (Units)', font: { size: 11, color: '#86868B' } } },
        legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 11, color: '#1D1D1F' } },
        barmode: 'overlay',
      }}
      useResizeHandler
      style={{ width: '100%', height: 240 }}
      config={{ displayModeBar: false }}
    />
  );
}

export function StrategyComparison({ results }: { results: StrategyResult[] }) {
  const labels = results.map(r =>
    r.strategy === 'fasttrade' ? 'FASTTRADE' : r.strategy.replaceAll('_', ' ').toUpperCase(),
  );
  return (
    <Plot
      data={[
        {
          x: labels,
          y: results.map(r => r.implementation_shortfall_bps),
          type: 'bar',
          name: 'Implementation Shortfall (bps)',
          marker: { color: '#0071E3' },
        },
        {
          x: labels,
          y: results.map(r => r.market_impact_bps),
          type: 'bar',
          name: 'Market Impact (bps)',
          marker: { color: '#00A854' },
        },
        {
          x: labels,
          y: results.map(r => r.adverse_selection_bps),
          type: 'bar',
          name: 'Adverse Selection (bps)',
          marker: { color: '#FF9500' },
        },
      ]}
      layout={{
        ...baseLayout,
        margin: { t: 22, r: 14, b: 38, l: 54 },
        barmode: 'group',
        xaxis: { ...baseLayout.xaxis, title: { text: 'Execution Strategy', font: { size: 11, color: '#86868B' } } },
        yaxis: { ...baseLayout.yaxis, title: { text: 'Execution Cost (bps)', font: { size: 11, color: '#86868B' } } },
        legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 11, color: '#1D1D1F' } },
      }}
      useResizeHandler
      style={{ width: '100%', height: 255 }}
      config={{ displayModeBar: false }}
    />
  );
}

type FeatureMetric = 'spread_bps' | 'depth_imbalance_l1' | 'ofi_instant' | 'volatility_std_10' | 'momentum_ret_5';

export function FeatureLineChart({
  points,
  metric,
  title,
  unit,
  multiplier = 1,
  color = '#0071E3',
}: {
  points: FeaturePoint[];
  metric: FeatureMetric;
  title: string;
  unit: string;
  multiplier?: number;
  color?: string;
}) {
  const latestVal = points.at(-1)?.[metric];
  const formattedLatest =
    latestVal !== null && latestVal !== undefined ? `${(latestVal * multiplier).toFixed(3)} ${unit}` : '—';

  return (
    <div className="feature-chart">
      <div className="feature-chart-header">
        <h3>{title}</h3>
        <span className="feature-live-val" style={{ color }}>
          {formattedLatest}
        </span>
      </div>
      <Plot
        data={[
          {
            x: points.map(p => p.timestamp),
            y: points.map(p => (p[metric] === null ? null : p[metric]! * multiplier)),
            type: 'scatter',
            mode: 'lines',
            name: title,
            line: { color, width: 2.2, shape: 'spline' },
            connectgaps: false,
          },
        ]}
        layout={{
          ...baseLayout,
          margin: { t: 8, r: 12, b: 28, l: 46 },
          xaxis: { ...baseLayout.xaxis, showticklabels: false },
          yaxis: { ...baseLayout.yaxis, title: { text: unit, font: { size: 10, color: '#86868B' } } },
          showlegend: false,
        }}
        useResizeHandler
        style={{ width: '100%', height: 170 }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}

export function MarketDepthChart({ points }: { points: FeaturePoint[] }) {
  const x = points.map(p => p.timestamp);
  const latest = points.at(-1);
  return (
    <div className="feature-chart">
      <div className="feature-chart-header">
        <h3>L1–L5 Book Depth</h3>
        <span className="feature-live-val">
          <span style={{ color: '#00A854' }}>B: {latest?.total_bid_depth.toFixed(0) ?? '—'}</span>
          {' / '}
          <span style={{ color: '#FF3B30' }}>A: {latest?.total_ask_depth.toFixed(0) ?? '—'}</span>
        </span>
      </div>
      <Plot
        data={[
          {
            x,
            y: points.map(p => p.total_bid_depth),
            type: 'scatter',
            mode: 'lines',
            name: 'Bid Depth',
            line: { color: '#00A854', width: 2.2, shape: 'spline' },
          },
          {
            x,
            y: points.map(p => p.total_ask_depth),
            type: 'scatter',
            mode: 'lines',
            name: 'Ask Depth',
            line: { color: '#FF3B30', width: 2.2, shape: 'spline' },
          },
        ]}
        layout={{
          ...baseLayout,
          margin: { t: 8, r: 12, b: 28, l: 46 },
          xaxis: { ...baseLayout.xaxis, showticklabels: false },
          yaxis: { ...baseLayout.yaxis, title: { text: 'Units', font: { size: 10, color: '#86868B' } } },
          legend: { orientation: 'h', y: 1.18, x: 0, font: { size: 10, color: '#1D1D1F' } },
        }}
        useResizeHandler
        style={{ width: '100%', height: 170 }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}
