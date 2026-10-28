"""Unit & Integration tests for FastTrade Institutional Auth, One-Click Demo Login, User Profile, Admin Panel, Self-Hosted Supabase Sync & Resend Email."""

from __future__ import annotations

import secrets
from fastapi.testclient import TestClient

from api.main import app

client = TestClient(app)


def test_oneclick_demo_login_trader_and_admin() -> None:
    res_trader = client.post("/api/v1/auth/demo-login", json={"role": "trader"})
    assert res_trader.status_code == 200
    assert res_trader.headers.get("X-Content-Type-Options") == "nosniff"
    assert res_trader.headers.get("X-Frame-Options") == "DENY"
    data_trader = res_trader.json()
    assert data_trader["token"].startswith("ft_")
    assert data_trader["user"]["email"] == "trader@fasttrade.ai"
    assert data_trader["user"]["role"] == "trader"

    res_admin = client.post("/api/v1/auth/demo-login", json={"role": "admin"})
    assert res_admin.status_code == 200
    data_admin = res_admin.json()
    assert data_admin["token"].startswith("ft_")
    assert data_admin["user"]["email"] == "admin@fasttrade.ai"
    assert data_admin["user"]["role"] == "admin"


def test_pretrade_monte_carlo_stress_and_optimizer() -> None:
    res = client.post(
        "/api/v1/dashboard/pretrade-stress",
        json={
            "scenario": "high_adverse_selection",
            "side": "buy",
            "order_size": 2500,
            "horizon_sec": 60,
            "risk_aversion": 0.0001,
            "risk_high_threshold": 0.65,
            "urgency_high_threshold": 0.75,
            "ac_num_slices": 12,
        },
    )
    assert res.status_code == 200
    payload = res.json()
    assert payload["monte_carlo_paths"] == 250
    assert payload["car_99_bps"] >= payload["car_95_bps"] >= payload["expected_shortfall_bps"]
    assert len(payload["percentile_curve"]) == 7
    assert "optimal_parameters" in payload
    assert payload["optimal_parameters"]["expected_improvement_bps"] > 0


def test_user_registration_and_profile_management() -> None:
    unique_email = f"quant_{secrets.token_hex(4)}@fasttrade.ai"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "QuantPassword!2026",
            "full_name": "Jordan Sterling",
            "organization": "Citadel Quant Execution",
            "title": "Execution Strategist",
            "role": "trader",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    token = reg_data["token"]
    assert reg_data["user"]["email"] == unique_email
    assert "email_dispatched" in reg_data

    # Update profile and preferences
    prof_res = client.put(
        "/api/v1/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Jordan Sterling, CFA",
            "title": "Lead Execution Strategist",
            "organization": "Citadel Global Equities",
            "preferences": {
                "default_order_size": 3500,
                "risk_high_threshold": 0.70,
            },
            "send_confirmation_email": False,
        },
    )
    assert prof_res.status_code == 200
    updated_user = prof_res.json()["user"]
    assert updated_user["full_name"] == "Jordan Sterling, CFA"
    assert updated_user["preferences"]["default_order_size"] == 3500
    assert updated_user["preferences"]["risk_high_threshold"] == 0.70


def test_admin_panel_overview_guardrails_and_supabase_sync() -> None:
    demo_admin = client.post("/api/v1/auth/demo-login", json={"role": "admin"}).json()
    token = demo_admin["token"]

    ov_res = client.get("/api/v1/admin/overview", headers={"Authorization": f"Bearer {token}"})
    assert ov_res.status_code == 200
    ov = ov_res.json()
    assert len(ov["users"]) >= 2
    assert "resend_status" in ov
    assert "database_status" in ov
    assert ov["database_status"]["project_url"] == "https://fasttrade-sb.propixer.in"

    cfg_res = client.put(
        "/api/v1/admin/config",
        headers={"Authorization": f"Bearer {token}"},
        json={"max_parent_order_size": 75000, "global_toxicity_ceiling": 0.80},
    )
    assert cfg_res.status_code == 200
    assert cfg_res.json()["system_config"]["max_parent_order_size"] == 75000
    assert cfg_res.json()["system_config"]["global_toxicity_ceiling"] == 0.80

    sync_res = client.post("/api/v1/admin/supabase-sync", headers={"Authorization": f"Bearer {token}"})
    assert sync_res.status_code == 200
    assert "sync_result" in sync_res.json()
