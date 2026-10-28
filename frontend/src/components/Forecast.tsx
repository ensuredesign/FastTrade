import type { ForecastState } from '../types';
import { ForecastChart } from '../charts/plots';

export function Forecast({
  forecast,
  activeTickIndex,
}: {
  forecast: ForecastState | null;
  activeTickIndex?: number | null;
}) {
  if (!forecast) {
    return (
      <section className="card">
        <div className="card-header">
          <div>
            <span className="card-tag">SEQUENCE FORECASTER</span>
            <h2>Directional Return Forecast</h2>
          </div>
        </div>
        <p className="empty">No forecast output in this run</p>
      </section>
    );
  }

  const visiblePoints =
    activeTickIndex !== undefined && activeTickIndex !== null && forecast.points.length > 0
      ? forecast.points.slice(0, Math.max(1, activeTickIndex + 1))
      : forecast.points;

  const latest = visiblePoints.at(-1);
  const latestValid = [...visiblePoints].reverse().find(point => point.valid);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="card-tag">
            20×14 SEQUENCE MODEL · {forecast.model_name.toUpperCase()} ({forecast.horizon} {forecast.horizon_unit.toUpperCase()})
          </span>
          <h2>Short-Horizon Directional Forecast</h2>
        </div>
        <span className="nvidia-pill">
          {forecast.source === 'nebius' ? 'NEBIUS REMOTE INFERENCE' : 'PYTORCH GRU ACTIVE'}
        </span>
      </div>

      <div className="metrics-grid-3">
        <div className="stat-box">
          <span>Model Status</span>
          <strong className="mono-val" style={{ color: latest?.valid ? '#10B981' : '#F59E0B' }}>
            {latest?.model_status ?? 'Unavailable'}
          </strong>
        </div>
        <div className="stat-box">
          <span>Expected Mid Move</span>
          <strong
            className="mono-val"
            style={{
              color:
                latestValid && latestValid.expected_move_bps !== null
                  ? latestValid.expected_move_bps >= 0
                    ? '#10B981'
                    : '#EF4444'
                  : '#9C9C9C',
            }}
          >
            {latestValid && latestValid.expected_move_bps !== null
              ? `${latestValid.expected_move_bps >= 0 ? '+' : ''}${latestValid.expected_move_bps.toFixed(2)} bps (${latestValid.direction})`
              : 'Warm-up (20 ticks)'}
          </strong>
        </div>
        <div className="stat-box">
          <span>Resulting Mode</span>
          <strong className="mono-val">{latest?.action.toUpperCase() ?? '—'}</strong>
        </div>
      </div>

      {visiblePoints.some(point => point.valid) ? (
        <ForecastChart points={visiblePoints} />
      ) : (
        <p className="empty">Accumulating 20-observation context window…</p>
      )}

      {latest && (
        <div className="audit-reason-box">
          <span className="audit-label">AUDITABLE ENGINE RATIONALE</span>
          <p>{latest.decision_reason}</p>
        </div>
      )}
    </section>
  );
}
