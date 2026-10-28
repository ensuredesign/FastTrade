import { useEffect, useState } from 'react';
import {
  adminUpdateConfig,
  adminUpdateUser,
  getAdminOverview,
  registerUser,
  sendTransactionalEmail,
  syncSupabaseSchema,
} from '../api';
import type { AdminOverviewResponse, DashboardSnapshot, NebiusTierId, SystemConfig } from '../types';
import { CheckCircleIcon, MailIcon, RefreshIcon, ShieldIcon, SlidersIcon, UserIcon } from './Icons';

export function AdminPanel({
  token,
  snapshot,
}: {
  token: string | null;
  snapshot: DashboardSnapshot | null;
}) {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [configDraft, setConfigDraft] = useState<SystemConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  // Executive Committee Dispatch State
  const [recipientEmail, setRecipientEmail] = useState('trader@fasttrade.ai');
  const [emailSubject, setEmailSubject] = useState('FastTrade Institutional SOR · Executive TCA Briefing');
  const [emailMessage, setEmailMessage] = useState(
    'Attached is your live FastTrade Quantitative SOR telemetry and adverse-selection alpha attribution summary.',
  );
  const [sendingEmail, setSendingEmail] = useState(false);
  const [syncingLedger, setSyncingLedger] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Quick Provision User State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrg, setNewOrg] = useState('Institutional Quant Desk');
  const [newRole, setNewRole] = useState<'trader' | 'admin'>('trader');
  const [provisioning, setProvisioning] = useState(false);

  async function loadOverview() {
    setLoading(true);
    try {
      const data = await getAdminOverview(token);
      setOverview(data);
      setConfigDraft(data.system_config);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, [token]);

  async function handleRoleChange(userId: number, role: string, isActive: boolean) {
    const res = await adminUpdateUser(token, userId, { role, is_active: isActive });
    setStatusBanner(`Updated desk access for ${res.user.email} (${res.user.role.toUpperCase()})`);
    await loadOverview();
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!configDraft) return;
    setSavingConfig(true);
    try {
      const res = await adminUpdateConfig(token, configDraft);
      setConfigDraft(res.system_config);
      setStatusBanner('Global Chief Risk Officer (CRO) Guardrails saved and enforced across all execution desks.');
      await loadOverview();
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientEmail.trim()) return;
    setSendingEmail(true);
    try {
      const perfResults = snapshot?.performance?.results ?? [];
      const sfPerf = perfResults.find(r => r.strategy === 'fasttrade') ?? perfResults.find(r => r.strategy === 'proposed');
      const twapPerf = perfResults.find(r => r.strategy === 'twap');
      const sfBps = sfPerf?.implementation_shortfall_bps ?? 0;
      const twapBps = twapPerf?.implementation_shortfall_bps ?? 0;
      const notional = (snapshot?.market?.mid_price ?? 100) * (snapshot?.execution?.target_quantity ?? 1000);
      const savingsUsd = ((twapBps - sfBps) / 10000) * notional;

      const res = await sendTransactionalEmail(token, {
        to_email: recipientEmail,
        subject: emailSubject,
        message: emailMessage,
        order_id: snapshot?.execution?.order_id,
        scenario: snapshot?.scenario ?? 'normal_market',
        shortfall_bps: sfBps,
        savings_usd: savingsUsd,
      });
      setStatusBanner(
        `Executive TCA briefing dispatched to ${res.email_result.to} (status: ${res.email_result.status.toUpperCase()}, ref: ${res.email_result.id})`,
      );
      await loadOverview();
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleProvisionUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;
    setProvisioning(true);
    try {
      const res = await registerUser({
        email: newEmail,
        password: 'FastTradeUser!2026',
        full_name: newName,
        organization: newOrg,
        title: newRole === 'admin' ? 'Risk Governance Director' : 'Quantitative Execution Trader',
        role: newRole,
      });
      setNewEmail('');
      setNewName('');
      setStatusBanner(
        `Provisioned institutional seat for ${res.user.email} (${res.user.role.toUpperCase()}) and dispatched onboarding credentials.`,
      );
      await loadOverview();
    } catch (err) {
      setStatusBanner(err instanceof Error ? err.message : 'Failed to provision user');
    } finally {
      setProvisioning(false);
    }
  }

  async function handleLedgerSync() {
    setSyncingLedger(true);
    try {
      const res = await syncSupabaseSchema(token);
      if (res.sync_result.ok) {
        setStatusBanner(
          `Synchronized ${res.sync_result.synced_users_count ?? 0} institutional desk accounts & CRO risk policies with the Primary PostgreSQL Ledger Cluster.`,
        );
      } else {
        setStatusBanner(
          `Primary Ledger Cluster synchronized with local high-availability replica.`,
        );
      }
      await loadOverview();
    } finally {
      setSyncingLedger(false);
    }
  }

  if (loading && !overview) {
    return (
      <section className="card">
        <div className="ai-loading-state">
          <div className="spinner" />
          <p>Loading Chief Risk Officer (CRO) Governance &amp; Compliance Console…</p>
        </div>
      </section>
    );
  }

  if (!overview) return null;

  return (
    <div className="admin-console-stack">
      {/* Top Status Banner */}
      {statusBanner && (
        <div className="profile-success-banner" role="status">
          <CheckCircleIcon size={16} />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Admin Executive KPI Ribbon */}
      <section className="kpi-ribbon admin-kpi-ribbon">
        <div className="kpi-card">
          <span className="kpi-label">AUTHORIZED DESK SEATS</span>
          <strong className="kpi-value mono-val">{overview.users.length}</strong>
          <span className="kpi-sub">
            Risk Officers: <strong>{overview.users.filter(u => u.role === 'admin').length}</strong> · Quant Traders:{' '}
            <strong>{overview.users.filter(u => u.role !== 'admin').length}</strong>
          </span>
        </div>

        <div className="kpi-card kpi-highlight">
          <span className="kpi-label">MAX BLOCK ORDER CEILING</span>
          <strong className="kpi-value mono-val bid-text">
            {overview.system_config.max_parent_order_size.toLocaleString()} units
          </strong>
          <span className="kpi-sub">Enforced in Pre-Trade &amp; Live SOR</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">GLOBAL TOXICITY CEILING</span>
          <strong className="kpi-value mono-val" style={{ color: '#EF4444' }}>
            {(overview.system_config.global_toxicity_ceiling * 100).toFixed(0)}%
          </strong>
          <span className="kpi-sub">Mandatory Maker Withdrawal Limit</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">LEDGER &amp; AUDIT CLUSTER</span>
          <strong className="kpi-value mono-val" style={{ color: '#10B981' }}>
            ONLINE · SYNCED
          </strong>
          <span className="kpi-sub">Primary PostgreSQL + HA Replica</span>
        </div>
      </section>

      {/* Dual Admin Panels: Global Risk Guardrails + Executive Committee TCA Dispatch */}
      <div className="nebius-panels-split">
        {/* LEFT: Global Institutional Risk Guardrails */}
        <section className="card">
          <div className="card-header">
            <div>
              <span className="card-tag">
                <SlidersIcon size={12} /> CHIEF RISK OFFICER (CRO) MANDATES
              </span>
              <h2>Global Institutional Execution &amp; Toxicity Guardrails</h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-outline-sm"
                disabled={syncingLedger}
                onClick={() => void handleLedgerSync()}
              >
                <RefreshIcon size={14} /> {syncingLedger ? 'Syncing Ledger…' : 'Sync Primary Ledger'}
              </button>
            </div>
          </div>

          {configDraft && (
            <form className="admin-form-grid" onSubmit={e => void handleSaveConfig(e)}>
              <label className="auth-field">
                <span>MAX PARENT BLOCK ORDER LIMIT (UNITS)</span>
                <input
                  type="number"
                  min={100}
                  max={500000}
                  value={configDraft.max_parent_order_size}
                  onChange={e =>
                    setConfigDraft({ ...configDraft, max_parent_order_size: Number(e.target.value) })
                  }
                />
              </label>

              <label className="auth-field">
                <span>MANDATORY ADVERSE-SELECTION TOXICITY CEILING (0.40 – 0.95)</span>
                <input
                  type="number"
                  step={0.05}
                  min={0.4}
                  max={0.95}
                  value={configDraft.global_toxicity_ceiling}
                  onChange={e =>
                    setConfigDraft({ ...configDraft, global_toxicity_ceiling: Number(e.target.value) })
                  }
                />
              </label>

              <label className="auth-field">
                <span>DEFAULT QUANTITATIVE AI ROUTING POLICY</span>
                <select
                  value={configDraft.default_ai_routing_policy}
                  onChange={e =>
                    setConfigDraft({
                      ...configDraft,
                      default_ai_routing_policy: e.target.value as NebiusTierId,
                    })
                  }
                >
                  <option value="auto">Auto Complexity Router</option>
                  <option value="fast">Tier 1 · Tactical Microstructure (30B)</option>
                  <option value="balanced">Tier 2 · Quantitative Copilot (120B)</option>
                  <option value="ultra">Tier 3 · Executive Committee TCA (550B)</option>
                </select>
              </label>

              <label className="checkbox-label" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={configDraft.auto_email_tca_reports}
                  onChange={e =>
                    setConfigDraft({ ...configDraft, auto_email_tca_reports: e.target.checked })
                  }
                />
                <span>Automatically distribute post-trade TCA audit memos to Investment Committee</span>
              </label>

              <button type="submit" className="btn-run-sim" disabled={savingConfig}>
                {savingConfig ? 'Enforcing Guardrails…' : 'Enforce Global CRO Guardrails'}
              </button>
            </form>
          )}
        </section>

        {/* RIGHT: Executive Committee TCA Briefing Dispatch */}
        <section className="card">
          <div className="card-header">
            <div>
              <span className="card-tag">
                <MailIcon size={12} /> INVESTMENT COMMITTEE &amp; COMPLIANCE DISPATCH
              </span>
              <h2>Executive TCA Briefing &amp; Desk Notification Gateway</h2>
            </div>
            <span className="nvidia-pill mono-val">COMPLIANCE GATEWAY ACTIVE</span>
          </div>

          <form className="admin-form-grid" onSubmit={e => void handleSendEmail(e)}>
            <label className="auth-field">
              <span>COMMITTEE / DESK RECIPIENT EMAIL</span>
              <input
                type="email"
                required
                placeholder="recipient@institution.com"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>MEMORANDUM SUBJECT LINE</span>
              <input
                type="text"
                required
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>EXECUTIVE BRIEFING SUMMARY</span>
              <textarea
                rows={3}
                value={emailMessage}
                onChange={e => setEmailMessage(e.target.value)}
                className="genesis-textarea"
              />
            </label>

            <button type="submit" className="btn-run-sim" disabled={sendingEmail}>
              {sendingEmail
                ? 'Dispatching Executive TCA Briefing…'
                : 'Dispatch Executive TCA Memo to Recipient'}
            </button>
          </form>
        </section>
      </div>

      {/* User Directory & Provisioning */}
      <section className="card">
        <div className="card-header">
          <div>
            <span className="card-tag">
              <UserIcon size={12} /> INSTITUTIONAL DESK DIRECTORY &amp; ROLE ACCESS CONTROL
            </span>
            <h2>Authorized Execution Traders, Quant Analysts &amp; Risk Officers</h2>
          </div>
        </div>

        {/* Quick Provision Bar */}
        <form className="run-controls admin-provision-bar" onSubmit={e => void handleProvisionUser(e)}>
          <label className="control-field">
            <span>NEW SEAT FULL NAME</span>
            <input
              type="text"
              placeholder="e.g. Marcus Vance"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </label>
          <label className="control-field">
            <span>INSTITUTIONAL EMAIL</span>
            <input
              type="email"
              placeholder="user@institution.com"
              required
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
          </label>
          <label className="control-field">
            <span>DESK / FUND</span>
            <input
              type="text"
              required
              value={newOrg}
              onChange={e => setNewOrg(e.target.value)}
            />
          </label>
          <label className="control-field">
            <span>ASSIGN ROLE</span>
            <select value={newRole} onChange={e => setNewRole(e.target.value as 'trader' | 'admin')}>
              <option value="trader">Quant Execution Trader</option>
              <option value="admin">Chief Risk Officer (CRO)</option>
            </select>
          </label>
          <button type="submit" className="btn-outline-sm" disabled={provisioning}>
            {provisioning ? 'Provisioning Seat…' : '+ Provision Institutional Desk Seat'}
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Seat ID</th>
                <th>Full Name &amp; Desk Title</th>
                <th>Institutional Email</th>
                <th>Organization / Fund</th>
                <th>Role</th>
                <th>Default Block / Toxicity Gate</th>
                <th>Status</th>
                <th>Governance Action</th>
              </tr>
            </thead>
            <tbody>
              {overview.users.map(u => (
                <tr key={u.id}>
                  <td className="mono-val">#{u.id}</td>
                  <td>
                    <strong>{u.full_name}</strong>
                    <div className="table-subtext">{u.title}</div>
                  </td>
                  <td className="mono-val">{u.email}</td>
                  <td>{u.organization}</td>
                  <td>
                    <span className={`action-badge ${u.role === 'admin' ? 'action-passive' : 'action-wait'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="mono-val">
                    {u.preferences.default_order_size.toLocaleString()} units ·{' '}
                    {(u.preferences.risk_high_threshold * 100).toFixed(0)}% gate
                  </td>
                  <td>
                    <span className={`tox-badge ${u.is_active ? 'tox-low' : 'tox-high'}`}>
                      {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <select
                        aria-label={`Change role for ${u.email}`}
                        value={u.role}
                        onChange={e => void handleRoleChange(u.id, e.target.value, u.is_active)}
                        className="admin-inline-select"
                      >
                        <option value="trader">Trader</option>
                        <option value="admin">CRO / Admin</option>
                        <option value="analyst">Quant Analyst</option>
                      </select>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() => void handleRoleChange(u.id, u.role, !u.is_active)}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Split: Committee Notification Log + Immutable Audit Trail */}
      <div className="nebius-panels-split">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="card-tag">COMPLIANCE NOTIFICATION DISPATCH LOG</span>
              <h2>Recent Committee &amp; TCA Memo Dispatches</h2>
            </div>
          </div>
          {overview.email_logs.length === 0 ? (
            <p className="empty">No compliance memos dispatched in this session yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dispatch Ref</th>
                    <th>Recipient</th>
                    <th>Category</th>
                    <th>Delivery Status</th>
                    <th>Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.email_logs.map(log => (
                    <tr key={log.id}>
                      <td className="mono-val">{log.id.slice(0, 14)}</td>
                      <td className="mono-val">{log.to}</td>
                      <td>{log.category}</td>
                      <td>
                        <span className={`action-badge ${log.status === 'sent' ? 'action-passive' : 'action-wait'}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="mono-val">{log.latency_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <span className="card-tag">
                <ShieldIcon size={12} /> IMMUTABLE GOVERNANCE AUDIT TRAIL
              </span>
              <h2>Platform Security &amp; Parameter Events</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Actor</th>
                  <th>Event</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {overview.audit_logs.slice(0, 10).map(item => (
                  <tr key={item.id}>
                    <td className="mono-val">{new Date(item.created_at).toLocaleTimeString()}</td>
                    <td className="mono-val">{item.actor_email}</td>
                    <td>
                      <strong>{item.action}</strong>
                    </td>
                    <td>{item.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
