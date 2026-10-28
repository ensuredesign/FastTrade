import type { ACScheduleState } from '../types';
import { ACScheduleChart } from '../charts/plots';

export function ACSchedule({ schedule }: { schedule: ACScheduleState | null }) {
  if (!schedule) {
    return (
      <section className="card ac-card">
        <div className="card-header">
          <div>
            <span className="card-tag">OPTIMAL LIQUIDATION MODEL</span>
            <h2>Almgren–Chriss Scheduled Trajectory</h2>
          </div>
        </div>
        <p className="empty">Waiting for an AC schedule…</p>
      </section>
    );
  }

  return (
    <section className="card ac-card">
      <div className="card-header">
        <div>
          <span className="card-tag">ALMGREN–CHRISS (2000) CLOSED-FORM OPTIMAL EXECUTION</span>
          <h2>Planned Liquidation Schedule & Cost-Variance Frontier</h2>
        </div>
        <div className="price-badge-group">
          <div className="mini-stat">
            <span>EXPECTED IMPACT COST</span>
            <strong className="mono-val">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: schedule.cost_unit }).format(
                schedule.expected_cost,
              )}
            </strong>
          </div>
          <div className="mini-stat">
            <span>UTILITY COST E[x]+λV[x]</span>
            <strong className="mono-val">${schedule.utility_cost.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className="metrics-grid-4">
        <div className="stat-box">
          <span>Parent Order Size</span>
          <strong className="mono-val">
            {schedule.total_quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} units
          </strong>
        </div>
        <div className="stat-box">
          <span>Execution Horizon</span>
          <strong className="mono-val">
            {schedule.horizon_sec.toFixed(0)} sec ({schedule.num_slices} slices)
          </strong>
        </div>
        <div className="stat-box">
          <span>Expected Market Cost E[x]</span>
          <strong className="mono-val">${schedule.expected_cost.toFixed(2)}</strong>
        </div>
        <div className="stat-box">
          <span>Trajectory Variance V[x]</span>
          <strong className="mono-val">{schedule.cost_variance.toFixed(2)}</strong>
        </div>
      </div>

      {schedule.points.length > 0 ? (
        <ACScheduleChart points={schedule.points} />
      ) : (
        <p className="empty">No schedule points available</p>
      )}
      <p className="feature-note">
        Closed-form hyperbolic trajectory x_j = sinh(κ(T - t_j)) / sinh(κT) · X_0 balancing temporary/permanent impact against volatility risk.
      </p>
    </section>
  );
}
