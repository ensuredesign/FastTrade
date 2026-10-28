import type { RiskState } from '../types';
import { RiskHistoryChart } from '../charts/plots';

function percent(value: number | null) {
  return value === null ? 'Unavailable' : `${(value * 100).toFixed(1)}%`;
}

export function Risk({
  risk,
  activeTickIndex,
}: {
  risk: RiskState | null;
  activeTickIndex?: number | null;
}) {
  if (!risk) {
    return (
      <section className="card">
        <div className="card-header">
          <div>
            <span className="card-tag">ML TOXICITY CLASSIFIER</span>
            <h2>Adverse-Selection Risk</h2>
          </div>
        </div>
        <p className="empty">Waiting for risk estimates…</p>
      </section>
    );
  }

  const visibleHistory =
    activeTickIndex !== undefined && activeTickIndex !== null && risk.history.length > 0
      ? risk.history.slice(0, Math.max(1, activeTickIndex + 1))
      : risk.history;

  const currentProb = visibleHistory.at(-1)?.adverse_selection_probability ?? risk.adverse_selection_probability;
  const probPct = currentProb * 100;
  const regimeLabel =
    probPct >= 65
      ? 'TOXIC FLOW · WITHDRAW MAKER'
      : probPct <= 35
        ? 'SAFE MAKER WINDOW'
        : 'MODERATE · FOLLOW AC SCHEDULE';
  const regimeClass = probPct >= 65 ? 'tox-high' : probPct <= 35 ? 'tox-low' : 'tox-mid';

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="card-tag">ML TOXICITY CLASSIFIER · {risk.model_name.toUpperCase()}</span>
          <h2>Adverse-Selection ("Winner's Curse") Risk</h2>
        </div>
        <span className={`tox-badge ${regimeClass}`}>{regimeLabel}</span>
      </div>

      <div className="metrics-grid-4">
        <div className="stat-box">
          <span>Post-Fill Toxicity Prob</span>
          <strong className="mono-val" style={{ color: probPct >= 65 ? '#EF4444' : probPct <= 35 ? '#10B981' : '#F59E0B' }}>
            {percent(currentProb)}
          </strong>
        </div>
        <div className="stat-box">
          <span>Classifier Status</span>
          <strong className="mono-val">{risk.model_status || 'TRAINED'}</strong>
        </div>
        <div className="stat-box">
          <span>Lookahead Horizon</span>
          <strong className="mono-val">
            {risk.prediction_horizon} {risk.prediction_horizon_unit}
          </strong>
        </div>
        <div className="stat-box">
          <span>Withdrawal Gate</span>
          <strong className="mono-val">≥ 65.0%</strong>
        </div>
      </div>

      {visibleHistory.length > 0 ? (
        <RiskHistoryChart points={visibleHistory} />
      ) : (
        <p className="empty">No risk history available</p>
      )}
      <p className="feature-note">
        Predicts probability of an adverse mid-price move exceeding 0.5× spread within {risk.prediction_horizon} ticks after a passive fill.
      </p>
    </section>
  );
}
