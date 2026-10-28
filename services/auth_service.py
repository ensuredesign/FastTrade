"""FastTrade Institutional Authentication, Self-Hosted Supabase Sync & Admin Governance Service.

Connects to Self-Hosted Supabase (`https://fasttrade-sb.propixer.in`) via REST/pg-meta APIs
with automatic dual-write and resilient SQLite fallback (`data/fasttrade.db` locally or
`/tmp/fasttrade.db` on Vercel Serverless Functions) + stateless HMAC-signed session tokens.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import tempfile
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from services.email_service import email_service
from services.portfolio_service import portfolio_service

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MIGRATION_SQL_PATH = PROJECT_ROOT / "supabase" / "migrations" / "20261028000000_fasttrade_schema.sql"


def _resolve_db_path() -> Path:
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path(tempfile.gettempdir()) / "fasttrade.db"
    return PROJECT_ROOT / "data" / "fasttrade.db"


DB_PATH = _resolve_db_path()

DEFAULT_PREFERENCES: Dict[str, Any] = {
    "default_scenario": "normal_market",
    "default_side": "buy",
    "default_order_size": 1000,
    "default_horizon_sec": 60,
    "risk_aversion": 0.0001,
    "risk_high_threshold": 0.65,
    "urgency_high_threshold": 0.75,
    "ac_num_slices": 12,
    "preferred_ai_tier": "auto",
    "email_notifications": True,
}

DEFAULT_SYSTEM_CONFIG: Dict[str, Any] = {
    "max_parent_order_size": 50000,
    "global_toxicity_ceiling": 0.85,
    "default_ai_routing_policy": "auto",
    "auto_email_tca_reports": True,
    "maintenance_mode": False,
    "updated_at": datetime.now(timezone.utc).isoformat(),
    "updated_by": "admin@fasttrade.ai",
}


def _hash_password(password: str, salt: Optional[str] = None) -> str:
    salt_hex = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt_hex.encode("utf-8"),
        100_000,
    )
    return f"{salt_hex}${dk.hex()}"


def _verify_password(password: str, stored_hash: str) -> bool:
    if "$" not in stored_hash:
        return False
    salt_hex, _ = stored_hash.split("$", 1)
    return secrets.compare_digest(_hash_password(password, salt_hex), stored_hash)


class AuthService:
    """Hybrid Self-Hosted Supabase (`https://fasttrade-sb.propixer.in`) + SQLite service."""

    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._last_supabase_sync: Optional[Dict[str, Any]] = None
        self._init_db()
        self._seed_demo_accounts()

    @property
    def supabase_url(self) -> str:
        return os.environ.get("SUPABASE_URL", "https://fasttrade-sb.propixer.in").rstrip("/")

    @property
    def supabase_anon_key(self) -> str:
        return os.environ.get(
            "SUPABASE_ANON_KEY",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MzIwMzIwMCwiZXhwIjo0OTQ4ODc2ODAwLCJyb2xlIjoiYW5vbiJ9.vqN7tNyDQi8_p1ANmfmSZR4-3XaOMHXBZrzgY05xz5o",
        ).strip()

    @property
    def supabase_service_key(self) -> str:
        return os.environ.get(
            "SUPABASE_SERVICE_ROLE_KEY",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MzIwMzIwMCwiZXhwIjo0OTQ4ODc2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.rKgIAVDQLEQ_67T_n-aWESFOa29rGEmrasIH3XtaMSs",
        ).strip()

    @property
    def supabase_db_user(self) -> str:
        return os.environ.get("SUPABASE_DB_USER", "xVpliwJaagJK87F1").strip()

    @property
    def supabase_db_password(self) -> str:
        return os.environ.get("SUPABASE_DB_PASSWORD", "T9Ryv0cdzcTPP3Oag5vgtjslJwfGajMC").strip()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'trader',
                    title TEXT NOT NULL DEFAULT 'Quantitative Execution Trader',
                    organization TEXT NOT NULL DEFAULT 'FastTrade Institutional Desk',
                    preferences_json TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    simulations_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    last_login_at TEXT
                );

                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                );

                CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT NOT NULL,
                    reset_code TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    used INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    actor_email TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS system_config (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    config_json TEXT NOT NULL
                );
                """
            )
            row = conn.execute("SELECT config_json FROM system_config WHERE id = 1").fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO system_config (id, config_json) VALUES (1, ?)",
                    (json.dumps(DEFAULT_SYSTEM_CONFIG),),
                )
            conn.commit()

    def _seed_demo_accounts(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        demo_users = [
            {
                "email": "admin@fasttrade.ai",
                "password": "FastTradeAdmin!2026",
                "full_name": "Dr. Elena Vance",
                "role": "admin",
                "title": "Managing Director & Chief Risk Officer",
                "organization": "FastTrade Institutional Governance",
                "preferences": {
                    **DEFAULT_PREFERENCES,
                    "default_order_size": 2500,
                    "default_horizon_sec": 90,
                    "risk_aversion": 0.00015,
                    "risk_high_threshold": 0.60,
                    "preferred_ai_tier": "ultra",
                },
                "simulations_count": 42,
            },
            {
                "email": "trader@fasttrade.ai",
                "password": "FastTradeTrader!2026",
                "full_name": "Alex Mercer",
                "role": "trader",
                "title": "Head of Quantitative Execution Desk",
                "organization": "Apex Alpha Capital Management",
                "preferences": {
                    **DEFAULT_PREFERENCES,
                    "default_order_size": 1000,
                    "default_horizon_sec": 60,
                    "risk_aversion": 0.0001,
                    "risk_high_threshold": 0.65,
                    "preferred_ai_tier": "auto",
                },
                "simulations_count": 28,
            },
        ]
        with self._connect() as conn:
            for u in demo_users:
                existing = conn.execute(
                    "SELECT id FROM users WHERE email = ?", (u["email"],)
                ).fetchone()
                if not existing:
                    conn.execute(
                        """
                        INSERT INTO users (
                            email, password_hash, full_name, role, title,
                            organization, preferences_json, is_active,
                            simulations_count, created_at, last_login_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                        """,
                        (
                            u["email"],
                            _hash_password(u["password"]),
                            u["full_name"],
                            u["role"],
                            u["title"],
                            u["organization"],
                            json.dumps(u["preferences"]),
                            u["simulations_count"],
                            now,
                            now,
                        ),
                    )
            conn.commit()

    def execute_supabase_sql(self, sql_query: str) -> Dict[str, Any]:
        """Execute SQL against the self-hosted Supabase pg-meta / Studio API."""
        ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FastTrade-Terminal/2.0"
        b64 = base64.b64encode(
            f"{self.supabase_db_user}:{self.supabase_db_password}".encode("utf-8")
        ).decode("ascii")

        endpoints = [
            (
                f"{self.supabase_url}/api/platform/pg-meta/default/query",
                {
                    "User-Agent": ua,
                    "Authorization": f"Basic {b64}",
                    "Content-Type": "application/json",
                },
            ),
            (
                f"{self.supabase_url}/pg/query",
                {
                    "User-Agent": ua,
                    "apikey": self.supabase_service_key,
                    "Authorization": f"Bearer {self.supabase_service_key}",
                    "Content-Type": "application/json",
                },
            ),
        ]

        last_err = ""
        for endpoint, headers in endpoints:
            try:
                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps({"query": sql_query}).encode("utf-8"),
                    headers=headers,
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=8.0) as resp:
                    body = resp.read().decode("utf-8", errors="ignore")
                    return {
                        "ok": True,
                        "status": "connected",
                        "endpoint": endpoint,
                        "response": body[:400],
                    }
            except urllib.error.HTTPError as exc:
                err_text = ""
                try:
                    err_text = exc.read().decode("utf-8", errors="ignore")
                except Exception:
                    err_text = str(exc)
                last_err = f"HTTP {exc.code}: {err_text[:280]}"
            except Exception as exc:
                last_err = str(exc)[:280]

        return {
            "ok": False,
            "status": "remote_db_pending",
            "project_url": self.supabase_url,
            "diagnostic": last_err,
        }

    def sync_schema_and_data_to_supabase(self) -> Dict[str, Any]:
        """Upload schema migration & current users/config to self-hosted Supabase."""
        migration_sql = ""
        if MIGRATION_SQL_PATH.exists():
            migration_sql = MIGRATION_SQL_PATH.read_text(encoding="utf-8")

        users = self.list_users()
        seed_statements: List[str] = []
        for u in users:
            email_esc = u["email"].replace("'", "''")
            name_esc = u["full_name"].replace("'", "''")
            role_esc = u["role"].replace("'", "''")
            title_esc = u["title"].replace("'", "''")
            org_esc = u["organization"].replace("'", "''")
            prefs_esc = json.dumps(u["preferences"]).replace("'", "''")
            seed_statements.append(
                f"""
                INSERT INTO public.fasttrade_users (email, password_hash, full_name, role, title, organization, preferences_json, is_active, simulations_count)
                VALUES ('{email_esc}', 'pbkdf2_synced', '{name_esc}', '{role_esc}', '{title_esc}', '{org_esc}', '{prefs_esc}'::jsonb, {str(u['is_active']).lower()}, {int(u['simulations_count'])})
                ON CONFLICT (email) DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    role = EXCLUDED.role,
                    title = EXCLUDED.title,
                    organization = EXCLUDED.organization,
                    preferences_json = EXCLUDED.preferences_json,
                    is_active = EXCLUDED.is_active;
                """
            )

        cfg_esc = json.dumps(self.get_system_config()).replace("'", "''")
        seed_statements.append(
            f"""
            INSERT INTO public.fasttrade_system_config (id, config_json, updated_at)
            VALUES (1, '{cfg_esc}'::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET
                config_json = EXCLUDED.config_json,
                updated_at = now();
            """
        )

        full_sql = migration_sql + "\n" + "\n".join(seed_statements)
        res = self.execute_supabase_sql(full_sql)
        self._last_supabase_sync = {
            **res,
            "synced_users_count": len(users),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        return self._last_supabase_sync

    def get_database_status(self) -> Dict[str, Any]:
        return {
            "project_url": self.supabase_url,
            "db_user": self.supabase_db_user,
            "anon_key_configured": bool(self.supabase_anon_key),
            "local_replica_path": str(self.db_path),
            "migration_file": "supabase/migrations/20261028000000_fasttrade_schema.sql",
            "last_sync": self._last_supabase_sync,
        }

    def _row_to_user(self, row: sqlite3.Row) -> Dict[str, Any]:
        try:
            prefs = json.loads(row["preferences_json"])
        except Exception:
            prefs = dict(DEFAULT_PREFERENCES)
        return {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": row["role"],
            "title": row["title"],
            "organization": row["organization"],
            "preferences": {**DEFAULT_PREFERENCES, **prefs},
            "is_active": bool(row["is_active"]),
            "simulations_count": row["simulations_count"],
            "created_at": row["created_at"],
            "last_login_at": row["last_login_at"],
        }

    def _sign_stateless_token(
        self,
        email: str,
        role: str,
        full_name: str = "",
        title: str = "",
        organization: str = "",
    ) -> str:
        payload = json.dumps(
            {
                "email": email,
                "role": role,
                "full_name": full_name,
                "title": title,
                "organization": organization,
                "nonce": secrets.token_hex(6),
            }
        )
        b64_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
        sig = hmac.new(
            self.supabase_anon_key.encode("utf-8"),
            b64_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:24]
        return f"ft_{b64_payload}.{sig}"

    def _verify_stateless_token_payload(self, token: str) -> Optional[Dict[str, Any]]:
        if not (token.startswith("ft_") or token.startswith("sf_")) or "." not in token:
            return None
        try:
            body = token[3:]
            b64_payload, sig = body.split(".", 1)
            expected_sig = hmac.new(
                self.supabase_anon_key.encode("utf-8"),
                b64_payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()[:24]
            if not hmac.compare_digest(sig, expected_sig):
                return None
            padding = "=" * (-len(b64_payload) % 4)
            data = json.loads(base64.urlsafe_b64decode(b64_payload + padding).decode("utf-8"))
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _verify_stateless_token(self, token: str) -> Optional[str]:
        payload = self._verify_stateless_token_payload(token)
        return payload.get("email") if payload else None

    def _sign_reset_token(self, email: str, reset_code: str, expires_epoch: int) -> str:
        payload = json.dumps({"email": email, "code": reset_code, "exp": expires_epoch})
        b64_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("ascii").rstrip("=")
        sig = hmac.new(
            self.supabase_anon_key.encode("utf-8"),
            b64_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:24]
        return f"rst_{b64_payload}.{sig}"

    def _verify_reset_token(self, reset_token: str, email: str, reset_code: str) -> bool:
        if not reset_token or not reset_token.startswith("rst_") or "." not in reset_token:
            return False
        try:
            body = reset_token[4:]
            b64_payload, sig = body.split(".", 1)
            expected_sig = hmac.new(
                self.supabase_anon_key.encode("utf-8"),
                b64_payload.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()[:24]
            if not hmac.compare_digest(sig, expected_sig):
                return False
            padding = "=" * (-len(b64_payload) % 4)
            data = json.loads(base64.urlsafe_b64decode(b64_payload + padding).decode("utf-8"))
            if int(data.get("exp", 0)) < int(time.time()):
                return False
            return (
                str(data.get("email", "")).lower() == email.lower()
                and secrets.compare_digest(str(data.get("code", "")), reset_code.strip())
            )
        except Exception:
            return False

    def _create_session(
        self,
        conn: sqlite3.Connection,
        user_id: int,
        email: str,
        role: str,
        full_name: str = "",
        title: str = "",
        organization: str = "",
    ) -> str:
        token = self._sign_stateless_token(
            email=email,
            role=role,
            full_name=full_name,
            title=title,
            organization=organization,
        )
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
            (token, user_id, now),
        )
        conn.execute(
            "UPDATE users SET last_login_at = ? WHERE id = ?",
            (now, user_id),
        )
        return token

    def _push_sql_async(self, sql_query: str) -> None:
        def _worker() -> None:
            try:
                self.execute_supabase_sql(sql_query)
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    def _upsert_user_supabase_async(self, u: Dict[str, Any], pw_hash: str = "pbkdf2_synced") -> None:
        email_esc = u["email"].replace("'", "''")
        name_esc = u["full_name"].replace("'", "''")
        role_esc = u["role"].replace("'", "''")
        title_esc = u["title"].replace("'", "''")
        org_esc = u["organization"].replace("'", "''")
        prefs_esc = json.dumps(u["preferences"]).replace("'", "''")
        pw_esc = pw_hash.replace("'", "''")
        sql = f"""
        INSERT INTO public.fasttrade_users (email, password_hash, full_name, role, title, organization, preferences_json, is_active, simulations_count)
        VALUES ('{email_esc}', '{pw_esc}', '{name_esc}', '{role_esc}', '{title_esc}', '{org_esc}', '{prefs_esc}'::jsonb, {str(u['is_active']).lower()}, {int(u['simulations_count'])})
        ON CONFLICT (email) DO UPDATE SET
            password_hash = CASE WHEN EXCLUDED.password_hash = 'pbkdf2_synced' THEN public.fasttrade_users.password_hash ELSE EXCLUDED.password_hash END,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            title = EXCLUDED.title,
            organization = EXCLUDED.organization,
            preferences_json = EXCLUDED.preferences_json,
            is_active = EXCLUDED.is_active;
        """
        self._push_sql_async(sql)

    def log_audit(self, actor_email: str, action: str, details: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO audit_logs (actor_email, action, details, created_at) VALUES (?, ?, ?, ?)",
                (actor_email, action, details, now),
            )
            conn.commit()
        actor_esc = actor_email.replace("'", "''")
        act_esc = action.replace("'", "''")
        det_esc = details.replace("'", "''")
        self._push_sql_async(
            f"INSERT INTO public.fasttrade_audit_logs (actor_email, action, details) VALUES ('{actor_esc}', '{act_esc}', '{det_esc}');"
        )

    def register_user(
        self,
        email: str,
        password: str,
        full_name: str,
        organization: str = "FastTrade Institutional Desk",
        title: str = "Quantitative Execution Trader",
        role: str = "trader",
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise ValueError("Please provide a valid institutional email address.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")
        if role not in ("trader", "admin", "analyst"):
            role = "trader"

        clean_name = full_name.strip() or clean_email.split("@")[0].title()
        clean_title = title.strip() or "Quantitative Execution Trader"
        clean_org = organization.strip() or "FastTrade Institutional Desk"

        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id FROM users WHERE email = ?", (clean_email,)
            ).fetchone()
            if existing:
                raise ValueError("An account with this email already exists.")

            cur = conn.execute(
                """
                INSERT INTO users (
                    email, password_hash, full_name, role, title,
                    organization, preferences_json, is_active,
                    simulations_count, created_at, last_login_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                """,
                (
                    clean_email,
                    _hash_password(password),
                    clean_name,
                    role,
                    clean_title,
                    clean_org,
                    json.dumps(DEFAULT_PREFERENCES),
                    now,
                    now,
                ),
            )
            user_id = int(cur.lastrowid)
            token = self._create_session(
                conn,
                user_id,
                clean_email,
                role,
                full_name=clean_name,
                title=clean_title,
                organization=clean_org,
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.commit()

        user_dict = self._row_to_user(row)
        self._upsert_user_supabase_async(user_dict, row["password_hash"])

        # Seed isolated per-user portfolio & trade blotter
        try:
            portfolio_service._seed_initial_trades(clean_email)
        except Exception:
            pass

        self.log_audit(
            clean_email,
            "USER_REGISTERED",
            f"Registered {user_dict['full_name']} ({role}) at {user_dict['organization']} with isolated $25M account",
        )

        email_result = email_service.send_welcome_email(
            email=clean_email,
            full_name=user_dict["full_name"],
            role=user_dict["role"],
            organization=user_dict["organization"],
        )

        return {
            "token": token,
            "user": user_dict,
            "email_dispatched": email_result,
            "email_notification": email_result,
        }

    def login_user(self, email: str, password: str) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?", (clean_email,)
            ).fetchone()
            if not row or not _verify_password(password, row["password_hash"]):
                raise ValueError("Invalid email or password.")
            if not row["is_active"]:
                raise ValueError("This account has been suspended by an administrator.")

            token = self._create_session(
                conn,
                int(row["id"]),
                clean_email,
                row["role"],
                full_name=row["full_name"],
                title=row["title"],
                organization=row["organization"],
            )
            updated = conn.execute(
                "SELECT * FROM users WHERE id = ?", (row["id"],)
            ).fetchone()
            conn.commit()

        user_dict = self._row_to_user(updated)
        try:
            portfolio_service._seed_initial_trades(clean_email)
        except Exception:
            pass
        self.log_audit(clean_email, "USER_LOGIN", f"Signed in to FastTrade Terminal ({user_dict['role']})")
        return {"token": token, "user": user_dict}

    def demo_login(self, role: str = "trader") -> Dict[str, Any]:
        target_email = "admin@fasttrade.ai" if role == "admin" else "trader@fasttrade.ai"
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE email = ?", (target_email,)
            ).fetchone()
            if not row:
                self._seed_demo_accounts()
                row = conn.execute(
                    "SELECT * FROM users WHERE email = ?", (target_email,)
                ).fetchone()
            token = self._create_session(
                conn,
                int(row["id"]),
                target_email,
                row["role"],
                full_name=row["full_name"],
                title=row["title"],
                organization=row["organization"],
            )
            updated = conn.execute(
                "SELECT * FROM users WHERE id = ?", (row["id"],)
            ).fetchone()
            conn.commit()

        user_dict = self._row_to_user(updated)
        self.log_audit(
            target_email,
            "DEMO_ONECLICK_LOGIN",
            f"One-click hackathon demo login as {user_dict['role'].upper()}",
        )
        return {"token": token, "user": user_dict}

    def get_user_by_token(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        if not token:
            return None
        clean_token = token.replace("Bearer ", "").strip()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT u.* FROM users u
                JOIN sessions s ON s.user_id = u.id
                WHERE s.token = ?
                """,
                (clean_token,),
            ).fetchone()
            if row:
                return self._row_to_user(row)

            # Stateless verification fallback for Vercel Serverless cold starts
            payload = self._verify_stateless_token_payload(clean_token)
            if payload and payload.get("email"):
                email = str(payload["email"]).strip().lower()
                row2 = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                if row2:
                    return self._row_to_user(row2)

                # Re-hydrate newly registered user on cold serverless worker
                now = datetime.now(timezone.utc).isoformat()
                role = str(payload.get("role") or "trader")
                full_name = str(payload.get("full_name") or email.split("@")[0].title())
                title = str(payload.get("title") or "Quantitative Execution Trader")
                organization = str(payload.get("organization") or "FastTrade Institutional Desk")
                conn.execute(
                    """
                    INSERT OR IGNORE INTO users (
                        email, password_hash, full_name, role, title,
                        organization, preferences_json, is_active,
                        simulations_count, created_at, last_login_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?)
                    """,
                    (
                        email,
                        _hash_password(secrets.token_hex(8)),
                        full_name,
                        role,
                        title,
                        organization,
                        json.dumps(DEFAULT_PREFERENCES),
                        now,
                        now,
                    ),
                )
                row3 = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
                conn.commit()
                if row3:
                    return self._row_to_user(row3)
            return None

    def request_password_reset(self, email: str) -> Dict[str, Any]:
        """Generate a 6-digit password reset code and dispatch it to the user's email via Resend."""
        clean_email = email.strip().lower()
        if not clean_email or "@" not in clean_email:
            raise ValueError("Please enter a valid email address.")

        now_dt = datetime.now(timezone.utc)
        expires_dt = now_dt + timedelta(minutes=15)
        expires_epoch = int(expires_dt.timestamp())
        reset_code = f"{secrets.randbelow(900000) + 100000}"

        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,)).fetchone()
            full_name = row["full_name"] if row else clean_email.split("@")[0].title()

            conn.execute(
                """
                INSERT INTO password_resets (email, reset_code, expires_at, used, created_at)
                VALUES (?, ?, ?, 0, ?)
                """,
                (clean_email, reset_code, expires_dt.isoformat(), now_dt.isoformat()),
            )
            conn.commit()

        reset_token = self._sign_reset_token(clean_email, reset_code, expires_epoch)
        email_result = email_service.send_password_reset_email(
            email=clean_email,
            full_name=full_name,
            reset_code=reset_code,
            expires_minutes=15,
        )
        self.log_audit(
            clean_email,
            "PASSWORD_RESET_REQUESTED",
            f"Dispatched 6-digit password reset code to {clean_email} -> status={email_result.get('status')}",
        )
        return {
            "ok": True,
            "email": clean_email,
            "reset_token": reset_token,
            "expires_in_minutes": 15,
            "email_dispatched": email_result,
            "email_notification": email_result,
            "message": f"A 6-digit password reset code has been sent to {clean_email}.",
        }

    def reset_password_with_code(
        self,
        email: str,
        reset_code: str,
        new_password: str,
        reset_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Verify the 6-digit reset code and update the user's password."""
        clean_email = email.strip().lower()
        clean_code = reset_code.strip()
        if not clean_email or "@" not in clean_email:
            raise ValueError("Please provide a valid email address.")
        if not clean_code or len(clean_code) < 4:
            raise ValueError("Please enter the 6-digit verification code sent to your email.")
        if len(new_password) < 6:
            raise ValueError("New password must be at least 6 characters.")

        now_iso = datetime.now(timezone.utc).isoformat()
        verified_by_token = bool(
            reset_token and self._verify_reset_token(reset_token, clean_email, clean_code)
        )

        with self._connect() as conn:
            reset_row = conn.execute(
                """
                SELECT * FROM password_resets
                WHERE email = ? AND reset_code = ? AND used = 0
                ORDER BY id DESC LIMIT 1
                """,
                (clean_email, clean_code),
            ).fetchone()

            if not reset_row and not verified_by_token:
                raise ValueError("Invalid or expired verification code. Please request a new code.")

            if reset_row:
                if str(reset_row["expires_at"]) < now_iso and not verified_by_token:
                    raise ValueError("Verification code has expired. Please request a new code.")
                conn.execute("UPDATE password_resets SET used = 1 WHERE id = ?", (reset_row["id"],))

            user_row = conn.execute("SELECT * FROM users WHERE email = ?", (clean_email,)).fetchone()
            new_pw_hash = _hash_password(new_password)

            if user_row:
                user_id = int(user_row["id"])
                conn.execute(
                    "UPDATE users SET password_hash = ?, last_login_at = ? WHERE id = ?",
                    (new_pw_hash, now_iso, user_id),
                )
            else:
                # Auto-provision if user reset on a fresh serverless worker
                cur = conn.execute(
                    """
                    INSERT INTO users (
                        email, password_hash, full_name, role, title,
                        organization, preferences_json, is_active,
                        simulations_count, created_at, last_login_at
                    ) VALUES (?, ?, ?, 'trader', 'Quantitative Execution Trader', 'FastTrade Institutional Desk', ?, 1, 0, ?, ?)
                    """,
                    (
                        clean_email,
                        new_pw_hash,
                        clean_email.split("@")[0].title(),
                        json.dumps(DEFAULT_PREFERENCES),
                        now_iso,
                        now_iso,
                    ),
                )
                user_id = int(cur.lastrowid)

            updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            token = self._create_session(
                conn,
                user_id,
                clean_email,
                updated["role"],
                full_name=updated["full_name"],
                title=updated["title"],
                organization=updated["organization"],
            )
            conn.commit()

        user_dict = self._row_to_user(updated)
        self._upsert_user_supabase_async(user_dict, new_pw_hash)
        try:
            portfolio_service._seed_initial_trades(clean_email)
        except Exception:
            pass

        email_result = email_service.send_password_changed_email(
            email=clean_email,
            full_name=user_dict["full_name"],
        )
        self.log_audit(
            clean_email,
            "PASSWORD_RESET_COMPLETED",
            f"Password reset completed via email verification for {clean_email}",
        )
        return {
            "token": token,
            "user": user_dict,
            "email_dispatched": email_result,
            "email_notification": email_result,
            "message": "Your password has been reset and you are now signed in.",
        }

    def change_password(
        self,
        user_id: int,
        current_password: str,
        new_password: str,
    ) -> Dict[str, Any]:
        """Change password for an authenticated user and send confirmation email."""
        if len(new_password) < 6:
            raise ValueError("New password must be at least 6 characters.")

        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise ValueError("User not found.")
            if current_password and not _verify_password(current_password, row["password_hash"]):
                raise ValueError("Current password is incorrect.")

            new_pw_hash = _hash_password(new_password)
            conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (new_pw_hash, user_id),
            )
            updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.commit()

        user_dict = self._row_to_user(updated)
        self._upsert_user_supabase_async(user_dict, new_pw_hash)
        email_result = email_service.send_password_changed_email(
            email=user_dict["email"],
            full_name=user_dict["full_name"],
        )
        self.log_audit(
            user_dict["email"],
            "PASSWORD_CHANGED",
            f"Changed account password for {user_dict['email']}",
        )
        return {
            "ok": True,
            "user": user_dict,
            "email_dispatched": email_result,
            "email_notification": email_result,
            "message": "Your password has been updated and a confirmation email was sent.",
        }

    def update_profile(
        self,
        user_id: int,
        full_name: Optional[str] = None,
        title: Optional[str] = None,
        organization: Optional[str] = None,
        preferences: Optional[Dict[str, Any]] = None,
        send_confirmation_email: bool = False,
        current_password: Optional[str] = None,
        new_password: Optional[str] = None,
    ) -> Dict[str, Any]:
        pw_hash_to_sync = "pbkdf2_synced"
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                raise ValueError("User not found.")
            current = self._row_to_user(row)

            next_name = full_name.strip() if full_name else current["full_name"]
            next_title = title.strip() if title else current["title"]
            next_org = organization.strip() if organization else current["organization"]
            next_prefs = {**current["preferences"], **(preferences or {})}

            if new_password:
                if len(new_password) < 6:
                    raise ValueError("New password must be at least 6 characters.")
                if current_password and not _verify_password(current_password, row["password_hash"]):
                    raise ValueError("Current password is incorrect.")
                pw_hash_to_sync = _hash_password(new_password)
                conn.execute(
                    """
                    UPDATE users
                    SET full_name = ?, title = ?, organization = ?, preferences_json = ?, password_hash = ?
                    WHERE id = ?
                    """,
                    (next_name, next_title, next_org, json.dumps(next_prefs), pw_hash_to_sync, user_id),
                )
            else:
                conn.execute(
                    """
                    UPDATE users
                    SET full_name = ?, title = ?, organization = ?, preferences_json = ?
                    WHERE id = ?
                    """,
                    (next_name, next_title, next_org, json.dumps(next_prefs), user_id),
                )
            updated = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            conn.commit()

        user_dict = self._row_to_user(updated)
        self._upsert_user_supabase_async(user_dict, pw_hash_to_sync)
        self.log_audit(
            user_dict["email"],
            "PROFILE_UPDATED",
            f"Updated desk profile & quantitative parameters for {user_dict['full_name']}",
        )

        email_result = None
        if new_password:
            email_result = email_service.send_password_changed_email(
                email=user_dict["email"],
                full_name=user_dict["full_name"],
            )
        elif send_confirmation_email:
            email_result = email_service.send_profile_update_email(
                email=user_dict["email"],
                full_name=user_dict["full_name"],
                preferences=user_dict["preferences"],
            )

        return {
            "user": user_dict,
            "email_dispatched": email_result,
            "email_notification": email_result,
        }

    def list_users(self) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
            return [self._row_to_user(r) for r in rows]

    def admin_update_user(
        self,
        actor_email: str,
        target_user_id: int,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (target_user_id,)).fetchone()
            if not row:
                raise ValueError("Target user not found.")
            next_role = role if role in ("admin", "trader", "analyst") else row["role"]
            next_active = int(is_active) if is_active is not None else row["is_active"]
            conn.execute(
                "UPDATE users SET role = ?, is_active = ? WHERE id = ?",
                (next_role, next_active, target_user_id),
            )
            updated = conn.execute("SELECT * FROM users WHERE id = ?", (target_user_id,)).fetchone()
            conn.commit()

        user_dict = self._row_to_user(updated)
        self._upsert_user_supabase_async(user_dict)
        self.log_audit(
            actor_email,
            "ADMIN_USER_UPDATE",
            f"Updated {user_dict['email']} -> role={user_dict['role']}, active={user_dict['is_active']}",
        )
        return user_dict

    def get_system_config(self) -> Dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute("SELECT config_json FROM system_config WHERE id = 1").fetchone()
            if not row:
                return dict(DEFAULT_SYSTEM_CONFIG)
            try:
                return {**DEFAULT_SYSTEM_CONFIG, **json.loads(row["config_json"])}
            except Exception:
                return dict(DEFAULT_SYSTEM_CONFIG)

    def update_system_config(self, actor_email: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        current = self.get_system_config()
        merged = {
            **current,
            **updates,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": actor_email,
        }
        with self._connect() as conn:
            conn.execute(
                "UPDATE system_config SET config_json = ? WHERE id = 1",
                (json.dumps(merged),),
            )
            conn.commit()
        self.log_audit(
            actor_email,
            "SYSTEM_CONFIG_UPDATED",
            f"Updated institutional risk guardrails: max_order={merged.get('max_parent_order_size')}, tox_ceiling={merged.get('global_toxicity_ceiling')}",
        )
        return merged

    def get_audit_logs(self, limit: int = 40) -> List[Dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
            return [dict(r) for r in rows]


auth_service = AuthService()
