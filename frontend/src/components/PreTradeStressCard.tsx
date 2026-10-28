import { useEffect, useState } from 'react';
import { runPreTradeStress } from '../api';
import type { PreTradeStressResponse, RunOptions } from '../types';
import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon, ShieldIcon, SparklesIcon } from './Icons';

export function PreTradeStressCard({
  options,
  onApplyOptimal,
}: {
  options: RunOptions;
  onApplyOptimal: (nextOptions: RunOptions) => void;
}) {
  const [stress, setStress] = useState<PreTradeStressResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function evaluateStress(currentOpts: RunOptions) {
    setLoading(true);
    try {
      const res = await runPreTradeStress(currentOpts);
      setStress(res);
    } catch {
      // keep previous stress state on transient error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void evaluateStress(options);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    options.scenario,
    options.side,
    options.order_size,
    options.horizon_sec,
    options.risk_aversion,
    options.risk_high_threshold,
    options.urgency_high_threshold,
    options.ac_num_slices,
  ]);

  if (!stress) {
    return (
      <section className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <span className="card-tag">PRE-TRADE MONTE CARLO COST-AT-RISK (CaR 95% / 99%) & CRO GUARDRAILS</span>
            <h2>Stochastic Block Impact & Parameter Auto-Optimizer</h2>
          </div>
        </div>
        <p className="empty">Simulating 250 stochastic Almgren–Chriss & toxicity jump paths…</p>
      </section>
    );
  }

  const totalAttribution = Math.max(
    0.01,
    stress.permanent_impact_bps + stress.temporary_impact_bps + stress.adverse_selection_drift_bps,
  );
  const permPct = (stress.permanent_impact_bps / totalAttribution) * 100;
  const tempPct = (stress.temporary_impact_bps / totalAttribution) * 100;
  const toxPct = (stress.adverse_selection_drift_bps / totalAttribution) * 100;

  const opt = stress.optimal_parameters;
  const maxPercentileBps = Math.max(...stress.percentile_curve.map(p => Math.abs(p.shortfall_bps)), 1);

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <div>
          <span className="card-tag">
            PRE-TRADE RISK ENGINE · {stress.monte_carlo_paths} STOCHASTIC JUMP-DIFFUSION PATHS · NOTIONAL $
            {stress.notional_usd.toLocaleString()}
          </span>
          <h2>Pre-Trade Monte Carlo Cost-at-Risk (CaR 95% / 99%) & Closed-Form Auto-Optimizer</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            className="status-pill"
            style={{
              background:
                stress.cro_guardrail_status === 'PASS'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : stress.cro_guardrail_status === 'CAPPED'
                    ? 'rgba(245, 158, 11, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
              color:
                stress.cro_guardrail_status === 'PASS'
                  ? '#10B981'
                  : stress.cro_guardrail_status === 'CAPPED'
                    ? '#F59E0B'
                    : '#EF4444',
              borderColor:
                stress.cro_guardrail_status === 'PASS'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : stress.cro_guardrail_status === 'CAPPED'
                    ? 'rgba(245, 158, 11, 0.35)'
                    : 'rgba(239, 68, 68, 0.35)',
            }}
          >
            {stress.cro_guardrail_status === 'PASS' ? (
              <CheckCircleIcon size={13} />
            ) : (
              <AlertTriangleIcon size={13} />
            )}
            CRO GUARDRAIL: {stress.cro_guardrail_status}
          </span>

          <button
            type="button"
            className="btn-outline-sm"
            disabled={loading}
            onClick={() => void evaluateStress(options)}
          >
            <RefreshIcon size={13} /> {loading ? 'Stress-Testing…' : 'Re-Run 250 Paths'}
          </button>
        </div>
      </div>

      {/* Top 4 Monte Carlo Risk Metrics */}
      <div className="stat-grid-4" style={{ marginBottom: 16 }}>
        <div className="stat-box">
          <span>Expected Shortfall E[IS]</span>
          <strong className="mono-val bid-text">{stress.expected_shortfall_bps.toFixed(2)} bps</strong>
          <small style={{ display: 'block', color: '#6B6B6B', fontSize: 11, marginTop: 2 }}>
            Est. Cost: ${stress.expected_shortfall_usd.toLocaleString()} (vs TWAP {stress.twap_expected_bps.toFixed(2)} bps)
          </small>
        </div>

        <div className="stat-box">
          <span>95% Cost-at-Risk (CaR 95%)</span>
          <strong className="mono-val" style={{ color: '#F59E0B' }}>
            {stress.car_95_bps.toFixed(2)} bps
          </strong>
          <small style={{ display: 'block', color: '#6B6B6B', fontSize: 11, marginTop: 2 }}>
            95th Percentile Ceiling: ${stress.car_95_usd.toLocaleString()}
          </small>
        </div>

        <div className="stat-box">
          <span>99% Tail Cost-at-Risk (CaR 99%)</span>
          <strong className="mono-val ask-text">{stress.car_99_bps.toFixed(2)} bps</strong>
          <small style={{ display: 'block', color: '#6B6B6B', fontSize: 11, marginTop: 2 }}>
            Extreme Tail Shock: ${stress.car_99_usd.toLocaleString()}
          </small>
        </div>

        <div className="stat-box">
          <span>Win Probability vs TWAP</span>
          <strong className="mono-val" style={{ color: '#6366F1' }}>
            {stress.win_prob_vs_twap_pct.toFixed(1)}%
          </strong>
          <small style={{ display: 'block', color: '#6B6B6B', fontSize: 11, marginTop: 2 }}>
            Outperforms uniform slicing across {stress.monte_carlo_paths} paths
          </small>
        </div>
      </div>

      {/* Dual Split: Left = Impact Decomposition & Percentile Distribution, Right = Closed-Form Optimizer & CRO Compliance */}
      <div className="nebius-panels-split">
        <div className="ai-subpanel">
          <div className="subpanel-header">
            <div>
              <span className="card-tag">PRE-TRADE MICROSTRUCTURE COST ATTRIBUTION</span>
              <h3>Permanent vs. Temporary Impact & Percentile Curve</h3>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 6,
                color: '#6B6B6B',
              }}
            >
              <span>
                <strong style={{ color: '#6366F1' }}>Permanent:</strong> {stress.permanent_impact_bps.toFixed(2)} bps (
                {permPct.toFixed(0)}%)
              </span>
              <span>
                <strong style={{ color: '#10B981' }}>Temporary:</strong> {stress.temporary_impact_bps.toFixed(2)} bps (
                {tempPct.toFixed(0)}%)
              </span>
              <span>
                <strong style={{ color: '#EF4444' }}>Toxicity Drift:</strong>{' '}
                {stress.adverse_selection_drift_bps.toFixed(2)} bps ({toxPct.toFixed(0)}%)
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                height: 10,
                borderRadius: 999,
                overflow: 'hidden',
                background: '#F3F3F6',
                border: '1px solid #E8E8EC',
              }}
            >
              <div style={{ width: `${permPct}%`, background: '#6366F1' }} title="Permanent Market Impact" />
              <div style={{ width: `${tempPct}%`, background: '#10B981' }} title="Temporary Liquidity Impact" />
              <div style={{ width: `${toxPct}%`, background: '#EF4444' }} title="Adverse-Selection Drift" />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {stress.percentile_curve.map(pt => {
              const widthPct = Math.min(100, Math.max(6, (Math.abs(pt.shortfall_bps) / maxPercentileBps) * 100));
              const isTail = pt.percentile.includes('95') || pt.percentile.includes('99');
              return (
                <div
                  key={pt.percentile}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr 150px',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: '#6B6B6B', fontWeight: isTail ? 600 : 400 }}>{pt.percentile}</span>
                  <div style={{ height: 7, background: '#F3F3F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: pt.percentile.includes('99')
                          ? '#EF4444'
                          : pt.percentile.includes('95')
                            ? '#F59E0B'
                            : '#6366F1',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <span className="mono-val" style={{ textAlign: 'right', fontWeight: isTail ? 600 : 500 }}>
                    {pt.shortfall_bps.toFixed(2)} bps (${pt.cost_usd.toFixed(0)})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ai-subpanel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="subpanel-header">
              <div>
                <span className="card-tag">CLOSED-FORM REGIME CALIBRATION & CRO GOVERNANCE</span>
                <h3>Optimal Execution Parameter Recommendation</h3>
              </div>
              <span className="tier-pill tier-fast">
                EST. GAIN: +{opt.expected_improvement_bps.toFixed(2)} bps (+${opt.expected_improvement_usd.toFixed(0)})
              </span>
            </div>

            <div className="brief-headline-banner" style={{ marginBottom: 12 }}>
              <SparklesIcon size={16} />
              <span>{opt.rationale}</span>
            </div>

            <div className="stat-grid-4" style={{ marginBottom: 12 }}>
              <div className="stat-box">
                <span>Optimal AC λ*</span>
                <strong className="mono-val">{opt.risk_aversion.toExponential(1)}</strong>
              </div>
              <div className="stat-box">
                <span>Toxicity Gate θ*</span>
                <strong className="mono-val" style={{ color: '#EF4444' }}>
                  {(opt.risk_high_threshold * 100).toFixed(0)}%
                </strong>
              </div>
              <div className="stat-box">
                <span>Urgency Gate</span>
                <strong className="mono-val" style={{ color: '#F59E0B' }}>
                  {(opt.urgency_high_threshold * 100).toFixed(0)}%
                </strong>
              </div>
              <div className="stat-box">
                <span>Optimal Slices N*</span>
                <strong className="mono-val" style={{ color: '#6366F1' }}>
                  {opt.ac_num_slices} slices
                </strong>
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: '#FAFAFA',
                border: '1px solid #E8E8EC',
                fontSize: 12,
                color: '#6B6B6B',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <ShieldIcon size={15} />
              <span>
                <strong>CRO Governance Check:</strong> {stress.cro_guardrail_message}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn-nvidia"
            style={{ width: '100%', justifyContent: 'center', padding: '11px 16px' }}
            onClick={() => {
              onApplyOptimal({
                ...options,
                risk_aversion: opt.risk_aversion,
                risk_high_threshold: opt.risk_high_threshold,
                urgency_high_threshold: opt.urgency_high_threshold,
                ac_num_slices: opt.ac_num_slices,
              });
            }}
          >
            <SparklesIcon size={15} /> Apply Optimal Quant Parameters (λ={opt.risk_aversion.toExponential(1)}, N=
            {opt.ac_num_slices}, Gate={(opt.risk_high_threshold * 100).toFixed(0)}%) & Re-Simulate
          </button>
        </div>
      </div>
    </section>
  );
}
