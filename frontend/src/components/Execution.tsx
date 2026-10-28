import type { ExecutionState } from '../types';
import { ExecutionActions, ExecutionTrajectory } from '../charts/plots';

export function Execution({
  execution,
  activeTickIndex,
}: {
  execution: ExecutionState | null;
  activeTickIndex?: number | null;
}) {
  if (!execution) {
    return (
      <section className="card">
        <div className="card-header">
          <div>
            <span className="card-tag">SMART ORDER ROUTER</span>
            <h2>Execution & Fill Trajectory</h2>
          </div>
        </div>
        <p className="empty">Waiting for an execution run…</p>
      </section>
    );
  }

  const visibleTrajectory =
    activeTickIndex !== undefined && activeTickIndex !== null
      ? execution.trajectory.slice(0, Math.max(1, activeTickIndex + 1))
      : execution.trajectory;

  const currentPoint = visibleTrajectory.at(-1);
  const currentFilled = currentPoint ? currentPoint.filled_quantity : execution.filled_quantity;
  const currentRem = currentPoint ? currentPoint.remaining_quantity : execution.remaining_quantity;
  const currentAction = currentPoint ? currentPoint.action : execution.selected_action;
  const fillPct = execution.target_quantity > 0 ? Math.min(100, (currentFilled / execution.target_quantity) * 100) : 0;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="card-tag">DYNAMIC SOR ENGINE · {execution.order_id}</span>
          <h2>
            <span className={execution.side === 'buy' ? 'bid-text' : 'ask-text'}>
              {execution.side.toUpperCase()}
            </span>{' '}
            {execution.target_quantity.toLocaleString()} {execution.symbol} Execution
          </h2>
        </div>
        <div className="price-badge-group">
          <span className={`action-pill action-${currentAction}`}>
            {currentAction === 'passive'
              ? 'PASSIVE MAKER'
              : currentAction === 'aggressive'
                ? 'AGGRESSIVE TAKER'
                : 'HOLD / WITHDRAW'}
          </span>
          <div className="mini-stat">
            <span>URGENCY</span>
            <strong className="mono-val">{(execution.execution_score * 100).toFixed(0)}%</strong>
          </div>
        </div>
      </div>

      {/* Fill Progress Bar */}
      <div className="imbalance-meter-wrap">
        <div className="imbalance-labels">
          <span>
            FILLED: <strong className="mono-val bid-text">{currentFilled.toFixed(1)}</strong> /{' '}
            {execution.target_quantity.toLocaleString()} ({fillPct.toFixed(1)}%)
          </span>
          <span>
            REMAINING: <strong className="mono-val">{currentRem.toFixed(1)}</strong> units
          </span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${fillPct}%` }} />
        </div>
      </div>

      {visibleTrajectory.length > 0 && (
        <>
          <ExecutionTrajectory points={visibleTrajectory} />
          <h3 className="chart-heading">Tactical Mode Switches (Maker / Taker / Hold)</h3>
          <ExecutionActions points={visibleTrajectory} />
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>SOR Mode</th>
                  <th>Cum. Filled</th>
                  <th>Remaining</th>
                  <th>Ref Mid</th>
                  <th>Fill Price</th>
                </tr>
              </thead>
              <tbody>
                {visibleTrajectory.slice(-6).reverse().map((point, index) => (
                  <tr key={`${point.timestamp}-${index}`}>
                    <td className="mono-val">{new Date(point.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span className={`action-badge action-${point.action}`}>
                        {point.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="mono-val">{point.filled_quantity.toFixed(1)}</td>
                    <td className="mono-val">{point.remaining_quantity.toFixed(1)}</td>
                    <td className="mono-val">${point.reference_price.toFixed(2)}</td>
                    <td className="mono-val">
                      {point.execution_price === null ? (
                        <span className="muted-dash">—</span>
                      ) : (
                        <strong className="bid-text">${point.execution_price.toFixed(2)}</strong>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
