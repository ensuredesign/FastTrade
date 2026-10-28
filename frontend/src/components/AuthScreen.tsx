import { useState } from 'react';
import { demoLogin, loginUser, registerUser, requestPasswordReset, resetPasswordWithCode } from '../api';
import type { AuthResponse } from '../types';
import { ActivityIcon, CheckCircleIcon, MailIcon, ShieldIcon, SparklesIcon, UserIcon } from './Icons';

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (auth: AuthResponse, meta?: { isNewRegistration?: boolean; isPasswordReset?: boolean }) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('trader@fasttrade.ai');
  const [password, setPassword] = useState('FastTradeTrader!2026');
  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('Apex Alpha Capital Management');
  const [title, setTitle] = useState('Senior Quantitative Execution Trader');
  const [role, setRole] = useState<'trader' | 'admin'>('trader');

  // Password recovery state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<'trader' | 'admin' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOneClickDemo(targetRole: 'trader' | 'admin') {
    setError(null);
    setDemoLoading(targetRole);
    try {
      const res = await demoLogin(targetRole);
      onAuthenticated(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Desk session initialization failed');
    } finally {
      setDemoLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginUser(email, password);
        onAuthenticated(res);
      } else if (mode === 'register') {
        const res = await registerUser({
          email,
          password,
          full_name: fullName,
          organization,
          title,
          role,
        });
        onAuthenticated(res, { isNewRegistration: true });
      } else if (mode === 'forgot') {
        const res = await requestPasswordReset(email);
        setResetToken(res.reset_token || '');
        const emailStatus = res.email_notification?.status === 'sent'
          ? `Delivered to ${res.email}`
          : `Dispatched (${res.email_notification?.status || 'sent'}) to ${res.email}`;
        setRecoveryInfo(
          `6-digit verification code sent via email (${emailStatus}). Valid for ${res.expires_in_minutes} minutes.`,
        );
        setMode('reset');
      } else if (mode === 'reset') {
        if (newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters.');
        }
        if (newPassword !== confirmNewPassword) {
          throw new Error('New password and confirmation do not match.');
        }
        const res = await resetPasswordWithCode({
          email,
          reset_code: resetCode.trim(),
          new_password: newPassword,
          reset_token: resetToken,
        });
        onAuthenticated(res, { isPasswordReset: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-wrap">
      <div className="auth-container">
        {/* Left Column: Institutional Brand & One-Click Desk Access */}
        <section className="auth-hero-panel">
          <div className="eyebrow-row">
            <span className="eyebrow">FASTTRADE // INSTITUTIONAL EMS &amp; QUANT RESEARCH v2.0</span>
            <span className="sponsor-tag">MULTI-VENUE SOR · L2 MICROSTRUCTURE · ISOLATED ACCOUNTS</span>
          </div>

          <h1>Institutional Smart Order Routing &amp; Quantitative Execution Terminal</h1>
          <p className="auth-lead">
            Unified execution management system coupling L2 order-book microstructure (Stoikov Micro-Price,
            Cont–Kukanov–Stoikov OFI), closed-form Almgren–Chriss trajectories, 250-path Pre-Trade Monte Carlo
            Cost-at-Risk (CaR 95%/99%), and per-user isolated $25M multi-asset portfolios.
          </p>

          {/* Institutional Desk Quick-Access Card */}
          <div className="demo-access-card">
            <div className="demo-card-header">
              <span className="badge-nebius">
                <SparklesIcon size={13} /> INSTITUTIONAL DESK QUICK-ACCESS
              </span>
              <span className="demo-sub-note">Pre-calibrated institutional desk workspaces</span>
            </div>

            <h3>1-Click Institutional Workspace Launch</h3>
            <p className="demo-desc">
              Enter directly into a pre-configured institutional session as either the Head of Quantitative Execution
              or Chief Risk Officer (CRO) to access live L2 execution, Pre-Trade Monte Carlo stress testing, and multi-strategy TCA.
            </p>

            <div className="demo-buttons-grid">
              <button
                type="button"
                className="demo-role-btn demo-trader-btn"
                disabled={demoLoading !== null || loading}
                onClick={() => void handleOneClickDemo('trader')}
              >
                <div className="demo-btn-top">
                  <span className="demo-icon-wrap">
                    <UserIcon size={18} />
                  </span>
                  <span className="demo-badge-pill">EXECUTION DESK</span>
                </div>
                <strong>{demoLoading === 'trader' ? 'Initializing EMS Desk…' : '1-Click Launch: Quant Execution Trader'}</strong>
                <span className="demo-meta">Alex Mercer · Head of Quantitative Execution Desk</span>
                <span className="demo-email mono-val">trader@fasttrade.ai</span>
              </button>

              <button
                type="button"
                className="demo-role-btn demo-admin-btn"
                disabled={demoLoading !== null || loading}
                onClick={() => void handleOneClickDemo('admin')}
              >
                <div className="demo-btn-top">
                  <span className="demo-icon-wrap admin-icon-wrap">
                    <ShieldIcon size={18} />
                  </span>
                  <span className="demo-badge-pill admin-pill">RISK GOVERNANCE</span>
                </div>
                <strong>{demoLoading === 'admin' ? 'Initializing CRO Desk…' : '1-Click Launch: Chief Risk Officer (CRO)'}</strong>
                <span className="demo-meta">Dr. Elena Vance · Managing Director &amp; Chief Risk Officer</span>
                <span className="demo-email mono-val">admin@fasttrade.ai</span>
              </button>
            </div>
          </div>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <CheckCircleIcon size={16} />
              <span>
                <strong>Isolated Per-User Accounts &amp; $25M Portfolios:</strong> Every registered trader gets an independent $25M portfolio, trade blotter, and custom Almgren–Chriss guardrails.
              </span>
            </div>
            <div className="auth-feature-item">
              <ActivityIcon size={16} />
              <span>
                <strong>Automated Transactional Email Delivery:</strong> Instant welcome email on registration, 6-digit email OTP password recovery, and profile security alerts.
              </span>
            </div>
          </div>
        </section>

        {/* Right Column: Sign In, Registration & Forgot Password Card */}
        <section className="auth-form-card">
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`}
              onClick={() => {
                setMode('login');
                setError(null);
                setRecoveryInfo(null);
              }}
            >
              Desk Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`}
              onClick={() => {
                setMode('register');
                setEmail('');
                setPassword('');
                setError(null);
                setRecoveryInfo(null);
              }}
            >
              Create Account
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'forgot' || mode === 'reset'}
              className={`auth-tab ${mode === 'forgot' || mode === 'reset' ? 'auth-tab-active' : ''}`}
              onClick={() => {
                setMode('forgot');
                setError(null);
                setRecoveryInfo(null);
              }}
            >
              Forgot Password
            </button>
          </div>

          <form className="auth-form" onSubmit={e => void handleSubmit(e)}>
            <h2>
              {mode === 'login' && 'Sign In to FastTrade EMS'}
              {mode === 'register' && 'Provision New Institutional Seat'}
              {mode === 'forgot' && 'Password Recovery via Email'}
              {mode === 'reset' && 'Enter Email Verification Code'}
            </h2>
            <p className="auth-form-sub">
              {mode === 'login' &&
                'Authenticate with your institutional desk credentials or use the 1-Click Launch profiles.'}
              {mode === 'register' &&
                'Register your personal institutional account. You will receive a welcome email and a dedicated $25M portfolio.'}
              {mode === 'forgot' &&
                'Enter your registered email address. We will immediately deliver a 6-digit password reset code to your inbox.'}
              {mode === 'reset' &&
                'Check your email inbox for the 6-digit verification code from FastTrade and choose your new password.'}
            </p>

            {recoveryInfo && (
              <div className="profile-success-banner" role="status">
                <MailIcon size={16} />
                <span>{recoveryInfo}</span>
              </div>
            )}

            {error && (
              <div className="auth-error-banner" role="alert">
                {error}
              </div>
            )}

            {mode === 'register' && (
              <>
                <label className="auth-field">
                  <span>FULL NAME</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Sterling"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </label>

                <div className="auth-field-row">
                  <label className="auth-field">
                    <span>INSTITUTION / DESK</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Citadel Quant Strategies"
                      value={organization}
                      onChange={e => setOrganization(e.target.value)}
                    />
                  </label>

                  <label className="auth-field">
                    <span>ACCOUNT ROLE</span>
                    <select value={role} onChange={e => setRole(e.target.value as 'trader' | 'admin')}>
                      <option value="trader">Quant Execution Trader</option>
                      <option value="admin">Chief Risk Officer (CRO)</option>
                    </select>
                  </label>
                </div>

                <label className="auth-field">
                  <span>DESK TITLE</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Portfolio Execution Lead"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className="auth-field">
              <span>INSTITUTIONAL EMAIL ADDRESS</span>
              <input
                type="email"
                required
                placeholder="name@institution.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </label>

            {(mode === 'login' || mode === 'register') && (
              <label className="auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>PASSWORD</span>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="auth-forgot-link"
                      onClick={() => {
                        setMode('forgot');
                        setError(null);
                        setRecoveryInfo(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </label>
            )}

            {mode === 'reset' && (
              <>
                <label className="auth-field">
                  <span>6-DIGIT EMAIL VERIFICATION CODE</span>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 482910"
                    className="mono-val"
                    style={{ letterSpacing: '0.18em', fontWeight: 700, fontSize: '1.05rem' }}
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value)}
                  />
                </label>

                <div className="auth-field-row">
                  <label className="auth-field">
                    <span>NEW PASSWORD</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </label>

                  <label className="auth-field">
                    <span>CONFIRM NEW PASSWORD</span>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Re-enter new password"
                      value={confirmNewPassword}
                      onChange={e => setConfirmNewPassword(e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {mode === 'register' && (
              <div className="auth-welcome-email-note">
                <MailIcon size={14} />
                <span>
                  A welcome email with your workspace credentials &amp; isolated $25M portfolio confirmation will be delivered to{' '}
                  <strong>{email || 'your email'}</strong>.
                </span>
              </div>
            )}

            <button type="submit" className="btn-run-sim auth-submit-btn" disabled={loading || demoLoading !== null}>
              {loading
                ? mode === 'login'
                  ? 'Authenticating Desk Session…'
                  : mode === 'register'
                    ? 'Provisioning Seat & Sending Welcome Email…'
                    : mode === 'forgot'
                      ? 'Sending 6-Digit Recovery Code…'
                      : 'Verifying Code & Updating Password…'
                : mode === 'login'
                  ? 'Sign In to FastTrade EMS'
                  : mode === 'register'
                    ? 'Register & Send Welcome Email'
                    : mode === 'forgot'
                      ? 'Send 6-Digit Recovery Code to Email'
                      : 'Reset Password & Sign In'}
            </button>

            {mode === 'forgot' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  ← Back to Sign In
                </button>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                  }}
                >
                  Already have a 6-digit code?
                </button>
              </div>
            )}

            {mode === 'reset' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                  }}
                >
                  ← Resend recovery code
                </button>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  Back to Sign In
                </button>
              </div>
            )}
          </form>

          {mode === 'login' && (
            <div className="auth-credentials-hint">
              <span>Institutional Desk Profiles:</span>
              <div className="cred-pills">
                <button
                  type="button"
                  className="cred-pill"
                  onClick={() => {
                    setEmail('trader@fasttrade.ai');
                    setPassword('FastTradeTrader!2026');
                  }}
                >
                  Load Quant Trader (`trader@fasttrade.ai`)
                </button>
                <button
                  type="button"
                  className="cred-pill"
                  onClick={() => {
                    setEmail('admin@fasttrade.ai');
                    setPassword('FastTradeAdmin!2026');
                  }}
                >
                  Load Chief Risk Officer (`admin@fasttrade.ai`)
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
