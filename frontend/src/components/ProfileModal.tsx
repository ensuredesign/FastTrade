import { useState } from 'react';
import { changeUserPassword, updateUserProfile } from '../api';
import type { NebiusTierId, ScenarioKey, Side, UserAccount, UserPreferences } from '../types';
import { CheckCircleIcon, CloseIcon, MailIcon, ShieldIcon, UserIcon } from './Icons';

export function ProfileModal({
  user,
  token,
  onClose,
  onProfileUpdated,
}: {
  user: UserAccount;
  token: string;
  onClose: () => void;
  onProfileUpdated: (updated: UserAccount, applyToTerminal: boolean) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [title, setTitle] = useState(user.title);
  const [organization, setOrganization] = useState(user.organization);

  const [prefs, setPrefs] = useState<UserPreferences>({ ...user.preferences });
  const [sendEmail, setSendEmail] = useState(true);
  const [applyNow, setApplyNow] = useState(true);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);
    try {
      if (newPassword || currentPassword) {
        if (!currentPassword) {
          throw new Error('Please enter your current password to set a new password.');
        }
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (newPassword !== confirmNewPassword) {
          throw new Error('New password and confirmation do not match.');
        }
      }

      const res = await updateUserProfile(token, {
        full_name: fullName,
        title,
        organization,
        preferences: prefs,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
        send_confirmation_email: sendEmail,
      });
      onProfileUpdated(res.user, applyNow);
      const dispatched = res.email_dispatched || res.email_notification;
      const emailMsg = dispatched
        ? ` · Confirmation email (${dispatched.status}) delivered to ${res.user.email}`
        : '';
      const pwdMsg = newPassword ? ' & password changed' : '';
      setFeedback(`Institutional desk profile, guardrails${pwdMsg} updated${emailMsg}.`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleDedicatedPasswordChange() {
    setFeedback(null);
    setError(null);
    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await changeUserPassword(token, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      onProfileUpdated(res.user, false);
      const emailStatus = res.email_notification?.status || 'sent';
      setFeedback(
        `Password updated successfully · Security confirmation email (${emailStatus}) delivered to ${res.user.email}.`,
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="tca-modal profile-modal" onClick={e => e.stopPropagation()}>
        <div className="tca-modal-header">
          <div>
            <span className="badge-nebius">
              <UserIcon size={13} /> INSTITUTIONAL ACCOUNT · PROFILE, SECURITY &amp; GUARDRAILS
            </span>
            <h2>{user.full_name} · Account &amp; Execution Preferences</h2>
          </div>
          <button type="button" className="btn-close-modal" aria-label="Close profile modal" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <form className="tca-modal-body profile-form" onSubmit={e => void handleSave(e)}>
          {feedback && (
            <div className="profile-success-banner" role="status">
              <CheckCircleIcon size={16} />
              <span>{feedback}</span>
            </div>
          )}
          {error && (
            <div className="auth-error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="profile-section-title">1. Institutional Identity &amp; Isolated Account Partition</div>
          <div className="profile-grid-3">
            <label className="auth-field">
              <span>FULL NAME</span>
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} />
            </label>

            <label className="auth-field">
              <span>DESK ROLE / TITLE</span>
              <input type="text" required value={title} onChange={e => setTitle(e.target.value)} />
            </label>

            <label className="auth-field">
              <span>ORGANIZATION / FUND</span>
              <input type="text" required value={organization} onChange={e => setOrganization(e.target.value)} />
            </label>
          </div>

          <div className="profile-meta-strip">
            <span>
              Account Email: <strong className="mono-val">{user.email}</strong>
            </span>
            <span>
              Access Tier: <strong className="mono-val">{user.role.toUpperCase()}</strong>
            </span>
            <span>
              Data Partition: <strong className="mono-val bid-text">ISOLATED ACCOUNT ($25M PORTFOLIO &amp; BLOTTER)</strong>
            </span>
          </div>

          <div className="profile-section-title">2. Default Quantitative Execution &amp; SOR Parameters</div>
          <div className="profile-grid-3">
            <label className="auth-field">
              <span>DEFAULT REGIME SCENARIO</span>
              <select
                value={prefs.default_scenario}
                onChange={e => setPrefs({ ...prefs, default_scenario: e.target.value as ScenarioKey })}
              >
                <option value="normal_market">Normal Market (Balanced Liquidity)</option>
                <option value="high_adverse_selection">High Adverse-Selection (Toxic Flow)</option>
                <option value="high_volatility">High Volatility (Jump Diffusion)</option>
                <option value="poor_liquidity">Poor Liquidity / Thin Book</option>
                <option value="large_order">Large Institutional Block (5,000 Units)</option>
              </select>
            </label>

            <label className="auth-field">
              <span>DEFAULT SIDE</span>
              <select
                value={prefs.default_side}
                onChange={e => setPrefs({ ...prefs, default_side: e.target.value as Side })}
              >
                <option value="buy">BUY (Accumulate)</option>
                <option value="sell">SELL (Liquidate)</option>
              </select>
            </label>

            <label className="auth-field">
              <span>PREFERRED AI REASONING TIER</span>
              <select
                value={prefs.preferred_ai_tier}
                onChange={e => setPrefs({ ...prefs, preferred_ai_tier: e.target.value as NebiusTierId })}
              >
                <option value="auto">Auto Complexity Router</option>
                <option value="fast">Fast · Tier 1 Tactical (30B)</option>
                <option value="balanced">Balanced · Tier 2 Quantitative (120B)</option>
                <option value="ultra">Ultra · Tier 3 Committee TCA (550B)</option>
              </select>
            </label>

            <label className="auth-field">
              <span>DEFAULT PARENT ORDER SIZE</span>
              <input
                type="number"
                min={10}
                max={100000}
                value={prefs.default_order_size}
                onChange={e => setPrefs({ ...prefs, default_order_size: Number(e.target.value) })}
              />
            </label>

            <label className="auth-field">
              <span>DEFAULT HORIZON (SEC)</span>
              <input
                type="number"
                min={10}
                max={300}
                value={prefs.default_horizon_sec}
                onChange={e => setPrefs({ ...prefs, default_horizon_sec: Number(e.target.value) })}
              />
            </label>

            <label className="auth-field">
              <span>TOXICITY WITHDRAWAL GATE</span>
              <input
                type="number"
                step={0.05}
                min={0.4}
                max={0.95}
                value={prefs.risk_high_threshold}
                onChange={e => setPrefs({ ...prefs, risk_high_threshold: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="profile-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <ShieldIcon size={13} /> 3. Account Security — Change Password
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'none' }}>
              Leave blank to keep your current password
            </span>
          </div>

          <div className="profile-grid-3">
            <label className="auth-field">
              <span>CURRENT PASSWORD</span>
              <input
                type="password"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>NEW PASSWORD</span>
              <input
                type="password"
                minLength={6}
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </label>

            <label className="auth-field">
              <span>CONFIRM NEW PASSWORD</span>
              <div style={{ display: 'flex', gap: '0.45rem' }}>
                <input
                  type="password"
                  minLength={6}
                  placeholder="Re-enter new password"
                  style={{ flex: 1 }}
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-outline-sm"
                  disabled={changingPassword || saving || (!currentPassword && !newPassword)}
                  onClick={() => void handleDedicatedPasswordChange()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {changingPassword ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </label>
          </div>

          <div className="profile-checkbox-row">
            <label className="checkbox-label">
              <input type="checkbox" checked={applyNow} onChange={e => setApplyNow(e.target.checked)} />
              <span>Immediately sync saved parameters into active FastTrade EMS order ticket</span>
            </label>

            <label className="checkbox-label">
              <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
              <span>
                <MailIcon size={14} /> Dispatch compliance confirmation notice to {user.email}
              </span>
            </label>
          </div>

          <div className="profile-actions-footer">
            <button type="button" className="btn-outline-sm" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn-run-sim" disabled={saving || changingPassword}>
              {saving ? 'Saving & Syncing…' : 'Save Desk Profile & Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
