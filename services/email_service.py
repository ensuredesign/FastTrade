"""Resend Transactional Email Service for FastTrade Institutional Terminal.

Integrates with Resend HTTP API (https://api.resend.com/emails) using
RESEND_API_KEY and RESEND_FROM_EMAIL ("FastTrade <info@ensure.in>").
"""

from __future__ import annotations

import html as html_lib
import json
import os
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


def _load_dotenv_if_present() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.exists():
        return
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and (key not in os.environ or key == "RESEND_FROM_EMAIL"):
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv_if_present()


class ResendEmailService:
    """Institutional email dispatch via Resend API with delivery audit trail."""

    def __init__(self) -> None:
        self._logs: List[Dict[str, Any]] = []

    @property
    def api_key(self) -> str:
        _load_dotenv_if_present()
        return os.environ.get("RESEND_API_KEY", "").strip()

    @property
    def from_email(self) -> str:
        _load_dotenv_if_present()
        return os.environ.get("RESEND_FROM_EMAIL", "FastTrade <info@ensure.in>").strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.startswith("re_"))

    def get_logs(self, limit: int = 30) -> List[Dict[str, Any]]:
        return list(reversed(self._logs[-limit:]))

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        category: str = "transactional",
    ) -> Dict[str, Any]:
        """Send an HTML email through Resend API and record delivery status."""
        t0 = time.perf_counter()
        timestamp = datetime.now(timezone.utc).isoformat()
        to_clean = to_email.strip()

        if not self.is_configured:
            entry = {
                "id": f"sim-{int(time.time() * 1000)}",
                "to": to_clean,
                "from": self.from_email,
                "subject": subject,
                "category": category,
                "status": "simulated_no_key",
                "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                "created_at": timestamp,
                "error": None,
            }
            self._logs.append(entry)
            return entry

        payload = {
            "from": self.from_email,
            "to": [to_clean],
            "subject": subject,
            "html": html_body,
        }

        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "User-Agent": "FastTrade-SOR-Terminal/2.0",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=12.0) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
                resend_id = raw.get("id", f"re-{int(time.time())}")
                entry = {
                    "id": resend_id,
                    "to": to_clean,
                    "from": self.from_email,
                    "subject": subject,
                    "category": category,
                    "status": "sent",
                    "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                    "created_at": timestamp,
                    "error": None,
                }
                self._logs.append(entry)
                return entry
        except urllib.error.HTTPError as exc:
            err_body = ""
            try:
                err_body = exc.read().decode("utf-8", errors="ignore")
            except Exception:
                err_body = str(exc)
            entry = {
                "id": f"err-{int(time.time() * 1000)}",
                "to": to_clean,
                "from": self.from_email,
                "subject": subject,
                "category": category,
                "status": f"http_{exc.code}",
                "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                "created_at": timestamp,
                "error": err_body[:240],
            }
            self._logs.append(entry)
            return entry
        except Exception as exc:
            entry = {
                "id": f"err-{int(time.time() * 1000)}",
                "to": to_clean,
                "from": self.from_email,
                "subject": subject,
                "category": category,
                "status": "error",
                "latency_ms": round((time.perf_counter() - t0) * 1000, 1),
                "created_at": timestamp,
                "error": str(exc)[:240],
            }
            self._logs.append(entry)
            return entry

    def _wrap_genesis_template(self, title: str, badge: str, content_html: str) -> str:
        return f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Segoe UI', Roboto, sans-serif; background-color: #F5F5F7; padding: 36px 16px; color: #1D1D1F;">
          <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid rgba(0,0,0,0.08); border-radius: 18px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
            <div style="margin-bottom: 16px;">
              <span style="display: inline-block; background: #0071E3; color: #FFFFFF; font-size: 11px; font-weight: 600; padding: 4px 12px; border-radius: 9999px; letter-spacing: 0.06em;">
                {badge}
              </span>
            </div>
            <h1 style="margin: 0 0 14px; font-size: 22px; font-weight: 600; color: #1D1D1F; letter-spacing: -0.02em;">
              {title}
            </h1>
            <div style="font-size: 14px; line-height: 1.6; color: #1D1D1F;">
              {content_html}
            </div>
            <hr style="border: 0; border-top: 1px solid #E5E5EA; margin: 26px 0 16px;" />
            <p style="margin: 0; font-size: 12px; color: #86868B;">
              FastTrade Institutional EMS &amp; Quant Terminal · Powered by Nebius Token Factory × NVIDIA Nemotron-3
            </p>
          </div>
        </div>
        """

    def send_welcome_email(
        self,
        email: str,
        full_name: str,
        role: str,
        organization: str,
    ) -> Dict[str, Any]:
        safe_name = html_lib.escape(full_name)
        safe_email = html_lib.escape(email)
        safe_org = html_lib.escape(organization)
        safe_role = html_lib.escape(role)
        html = self._wrap_genesis_template(
            title=f"Welcome to FastTrade Institutional EMS, {safe_name}",
            badge="WELCOME · ACCOUNT PROVISIONED",
            content_html=f"""
            <p>Welcome aboard! Your dedicated institutional execution seat and isolated multi-asset portfolio account have been provisioned on <strong>FastTrade</strong>.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #F5F5F7; border: 1px solid #E5E5EA; border-radius: 12px;">
              <tr><td style="padding: 10px 14px; color: #6E6E73;">Registered Email</td><td style="padding: 10px 14px; font-weight: 600;">{safe_email}</td></tr>
              <tr><td style="padding: 10px 14px; color: #6E6E73;">Full Name</td><td style="padding: 10px 14px; font-weight: 600;">{safe_name}</td></tr>
              <tr><td style="padding: 10px 14px; color: #6E6E73;">Organization / Desk</td><td style="padding: 10px 14px; font-weight: 600;">{safe_org}</td></tr>
              <tr><td style="padding: 10px 14px; color: #6E6E73;">Desk Role</td><td style="padding: 10px 14px; font-weight: 600; text-transform: uppercase;">{safe_role}</td></tr>
              <tr><td style="padding: 10px 14px; color: #6E6E73;">Dedicated Desk Capital</td><td style="padding: 10px 14px; font-weight: 600; color: #00A854;">$25,000,000.00 USD (Isolated Account)</td></tr>
            </table>
            <p>Your account includes isolated storage for your portfolio positions, execution trade blotter, custom Almgren–Chriss / SOR risk parameters, and persistent AI Copilot memory.</p>
            <p style="margin-top: 18px;">
              <a href="https://fasttrade-smoky.vercel.app" style="display: inline-block; background: #0071E3; color: #FFFFFF; text-decoration: none; font-weight: 600; padding: 10px 20px; border-radius: 980px; font-size: 13px;">
                Launch FastTrade Terminal →
              </a>
            </p>
            """,
        )
        return self.send_email(
            to_email=email,
            subject=f"Welcome to FastTrade Institutional EMS, {full_name}",
            html_body=html,
            category="onboarding",
        )

    def send_password_reset_email(
        self,
        email: str,
        full_name: str,
        reset_code: str,
        expires_minutes: int = 15,
    ) -> Dict[str, Any]:
        safe_name = html_lib.escape(full_name)
        safe_email = html_lib.escape(email)
        safe_code = html_lib.escape(reset_code)
        html = self._wrap_genesis_template(
            title="FastTrade Password Reset Verification Code",
            badge="ACCOUNT SECURITY · PASSWORD RESET",
            content_html=f"""
            <p>Hello <strong>{safe_name}</strong> ({safe_email}),</p>
            <p>We received a request to reset the password for your FastTrade institutional account. Enter the 6-digit verification code below in the FastTrade terminal to set a new password:</p>
            <div style="margin: 20px 0; padding: 18px; background: #F5F5F7; border: 1px solid #D2D2D7; border-radius: 14px; text-align: center;">
              <span style="display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: #6E6E73; margin-bottom: 6px;">VERIFICATION CODE (VALID FOR {expires_minutes} MINUTES)</span>
              <strong style="font-family: 'SF Mono', 'JetBrains Mono', monospace; font-size: 28px; letter-spacing: 0.22em; color: #0071E3;">{safe_code}</strong>
            </div>
            <p style="font-size: 13px; color: #6E6E73;">If you did not request a password reset, you can safely ignore this email—your account credentials remain unchanged.</p>
            """,
        )
        return self.send_email(
            to_email=email,
            subject=f"FastTrade Password Reset Code: {reset_code}",
            html_body=html,
            category="password_reset",
        )

    def send_password_changed_email(
        self,
        email: str,
        full_name: str,
    ) -> Dict[str, Any]:
        safe_name = html_lib.escape(full_name)
        safe_email = html_lib.escape(email)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        html = self._wrap_genesis_template(
            title="Your FastTrade Account Password Was Updated",
            badge="SECURITY CONFIRMATION",
            content_html=f"""
            <p>Hello <strong>{safe_name}</strong>,</p>
            <p>This is an automated security confirmation that the password for your FastTrade account (<strong>{safe_email}</strong>) was successfully updated at <strong>{ts}</strong>.</p>
            <p style="font-size: 13px; color: #6E6E73;">All your personal portfolio holdings, trade blotter records, and quantitative execution preferences remain safely stored in your isolated account.</p>
            """,
        )
        return self.send_email(
            to_email=email,
            subject="FastTrade Security Alert: Password Updated",
            html_body=html,
            category="security_alert",
        )

    def send_profile_update_email(
        self,
        email: str,
        full_name: str,
        preferences: Dict[str, Any],
    ) -> Dict[str, Any]:
        safe_name = html_lib.escape(full_name)
        safe_tier = html_lib.escape(str(preferences.get('preferred_ai_tier', 'auto')).upper())
        html = self._wrap_genesis_template(
            title="FastTrade Execution Desk Profile & Guardrails Updated",
            badge="DESK PREFERENCES SYNCED",
            content_html=f"""
            <p>Hello <strong>{safe_name}</strong>, your quantitative execution preferences have been updated:</p>
            <ul style="background: #FAFAFA; border: 1px solid #E8E8EC; border-radius: 8px; padding: 14px 28px;">
              <li><strong>Default Parent Order Size:</strong> {int(preferences.get('default_order_size', 1000))} units</li>
              <li><strong>Default Horizon:</strong> {int(preferences.get('default_horizon_sec', 60))} seconds</li>
              <li><strong>Almgren–Chriss Risk Aversion (λ):</strong> {float(preferences.get('risk_aversion', 0.0001))}</li>
              <li><strong>Toxicity Withdrawal Gate:</strong> {int(float(preferences.get('risk_high_threshold', 0.65)) * 100)}%</li>
              <li><strong>Preferred Nemotron Tier:</strong> {safe_tier}</li>
            </ul>
            """,
        )
        return self.send_email(
            to_email=email,
            subject="FastTrade Execution Desk Profile Updated",
            html_body=html,
            category="profile_update",
        )

    def send_tca_report_email(
        self,
        email: str,
        order_id: str,
        scenario: str,
        shortfall_bps: float,
        savings_usd: float,
        report_markdown: str,
    ) -> Dict[str, Any]:
        safe_report = (
            report_markdown.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        html = self._wrap_genesis_template(
            title=f"FastTrade Executive Post-Trade TCA Audit · {order_id}",
            badge="NVIDIA NEMOTRON-3 ULTRA 550B AUDIT",
            content_html=f"""
            <p>Attached below is the institutional Post-Trade Transaction Cost Analysis (TCA) memo generated for order <strong>{order_id}</strong> under scenario <strong>{scenario}</strong>.</p>
            <div style="display: flex; gap: 12px; margin: 16px 0; background: #FAFAFA; border: 1px solid #E8E8EC; border-radius: 8px; padding: 12px;">
              <div style="margin-right: 24px;">
                <span style="font-size: 11px; color: #6B6B6B; display: block;">FASTTRADE SHORTFALL</span>
                <strong style="font-size: 18px; color: #10B981;">{shortfall_bps:.2f} bps</strong>
              </div>
              <div>
                <span style="font-size: 11px; color: #6B6B6B; display: block;">ALPHA SAVED VS TWAP</span>
                <strong style="font-size: 18px; color: #6366F1;">+${savings_usd:,.2f}</strong>
              </div>
            </div>
            <pre style="white-space: pre-wrap; font-family: 'DM Sans', sans-serif; font-size: 13px; background: #FAFAFA; border: 1px solid #E8E8EC; border-radius: 8px; padding: 16px; color: #0A0A0A;">{safe_report}</pre>
            """,
        )
        return self.send_email(
            to_email=email,
            subject=f"FastTrade Executive TCA Memo · {order_id} ({scenario})",
            html_body=html,
            category="tca_audit",
        )


email_service = ResendEmailService()
