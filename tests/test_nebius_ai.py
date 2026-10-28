"""Tests for Nebius Token Factory + NVIDIA Nemotron Multi-Tier Agentic Service and FastAPI routes."""

from __future__ import annotations

from fastapi.testclient import TestClient
from api.main import app
from services.nebius_ai import NebiusAIService

client = TestClient(app)


def test_nebius_model_tier_routing_logic():
    """Verify automatic Model-Tier Routing selects Fast, Balanced, or Ultra NVIDIA Nemotron tiers."""
    svc = NebiusAIService(api_key="")  # Offline mode for unit test determinism

    t_fast, r_fast = svc.route_tier("tactical_brief")
    assert t_fast.tier_id == "fast"
    assert "Nemotron-3-Nano-30B" in t_fast.model_id
    assert "FAST" in r_fast

    t_ultra, r_ultra = svc.route_tier("tca_report")
    assert t_ultra.tier_id == "ultra"
    assert "Nemotron-3-Ultra-550b" in t_ultra.model_id
    assert "ULTRA" in r_ultra

    t_bal, r_bal = svc.route_tier("copilot", query="Why did FastTrade switch from passive to aggressive?")
    assert t_bal.tier_id == "balanced"
    assert "nemotron-3-super-120b" in t_bal.model_id

    t_override, _ = svc.route_tier("copilot", query="Quick status", requested_tier="ultra")
    assert t_override.tier_id == "ultra"


def test_ai_status_endpoint():
    """Verify GET /api/v1/ai/status returns Nebius Token Factory and 3 NVIDIA Nemotron model tiers."""
    resp = client.get("/api/v1/ai/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "Nebius Token Factory"
    assert len(data["nvidia_model_tiers"]) == 3
    tier_ids = {t["tier_id"] for t in data["nvidia_model_tiers"]}
    assert tier_ids == {"fast", "balanced", "ultra"}


def test_ai_tactical_brief_and_copilot_endpoints():
    """Verify POST /api/v1/ai/tactical-brief and /api/v1/ai/copilot return structured responses."""
    brief_resp = client.post("/api/v1/ai/tactical-brief", json={"tier": "fast"})
    assert brief_resp.status_code == 200
    brief = brief_resp.json()
    assert brief["provider"] == "Nebius Token Factory"
    assert brief["tier"] == "fast"
    assert "headline" in brief
    assert "regime_assessment" in brief
    assert "routing_rationale" in brief
    assert "alpha_highlight" in brief
    assert "risk_guardrail" in brief

    copilot_resp = client.post(
        "/api/v1/ai/copilot",
        json={"query": "What is the current spread and shortfall vs TWAP?", "tier": "auto"},
    )
    assert copilot_resp.status_code == 200
    cop = copilot_resp.json()
    assert cop["provider"] == "Nebius Token Factory"
    assert len(cop["answer"]) > 10
    assert len(cop["suggested_followups"]) >= 2



def test_phase3_venue_routing_and_parameter_tuning():
    """Verify Phase 3 Multi-Venue SOR allocation, regime detection, and custom parameter tuning."""
    resp = client.post(
        "/api/v1/dashboard/run",
        json={
            "scenario": "high_adverse_selection",
            "side": "buy",
            "order_size": 2500,
            "horizon_sec": 60,
            "risk_aversion": 0.0005,
            "risk_high_threshold": 0.60,
            "urgency_high_threshold": 0.80,
            "ac_num_slices": 16,
        },
    )
    assert resp.status_code == 200
    data = resp.json()

    # Verify Multi-Venue Routing
    vr = data.get("venue_routing")
    assert vr is not None
    assert len(vr["venues"]) == 4
    assert abs(sum(v["routed_quantity"] for v in vr["venues"]) - 2500.0) < 0.5
    assert vr["avg_price"] > 0

    # Verify Detected Regime Info
    regime = data.get("regime_info")
    assert regime is not None
    assert len(regime["badge_label"]) > 0

    # Verify Active Tuned Parameters
    params = data.get("active_parameters")
    assert params is not None
    assert abs(params["risk_aversion"] - 0.0005) < 1e-7
    assert abs(params["risk_high_threshold"] - 0.60) < 1e-5
    assert abs(params["urgency_high_threshold"] - 0.80) < 1e-5
    assert params["ac_num_slices"] == 16
    assert data["ac_schedule"]["num_slices"] == 16


def test_multi_step_autonomous_agent_workflow():
    """Verify POST /api/v1/ai/agent-workflow executes 5 stages, 3 sandbox iterations, and commits real blotter action."""
    resp = client.post(
        "/api/v1/ai/agent-workflow",
        json={
            "mission": "Optimize NVDA institutional block order with 3-cycle sandbox backtest and blotter commit",
            "auto_commit_trade": True,
            "user_email": "trader@fasttrade.ai",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "Nebius Token Factory"
    assert len(data["models_orchestrated"]) == 3
    assert len(data["steps"]) == 5
    assert len(data["sandbox_iterations"]) == 3
    # Verify monotonic shortfall improvement across the 3 test-and-refine iterations
    it1, it2, it3 = data["sandbox_iterations"]
    assert it1["shortfall_bps"] > it2["shortfall_bps"] > it3["shortfall_bps"]
    assert it3["assertions_passed"] == "4/4 PASSED"
    assert data["committed_trade"] is not None
    assert data["committed_trade"]["trade_id"].startswith("TRD-")


def test_self_iterating_quant_coding_agent():
    """Verify POST /api/v1/ai/coding-agent synthesizes, AST-validates, and iteratively refactors 3 Python code versions."""
    resp = client.post(
        "/api/v1/ai/coding-agent",
        json={
            "prompt": "Write an OFI-weighted adaptive execution algorithm that halts passive quoting when toxicity > 54%.",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "Nebius Token Factory"
    assert len(data["iterations"]) == 3
    assert data["iterations"][0]["passed_count"] == 2
    assert data["iterations"][1]["passed_count"] == 3
    assert data["iterations"][2]["passed_count"] == 4
    assert "def compute_execution_slice_v3" in data["final_code"]


def test_persistent_episodic_memory_and_action_assistant():
    """Verify GET/POST /api/v1/ai/memory and context-aware assistant actions in POST /api/v1/ai/copilot."""
    mem_resp = client.get("/api/v1/ai/memory")
    assert mem_resp.status_code == 200
    mem_data = mem_resp.json()
    assert mem_data["total_memories"] >= 4

    add_resp = client.post(
        "/api/v1/ai/memory",
        json={
            "category": "RISK_MANDATE",
            "symbol_scope": "NVDA",
            "rule_summary": "Cap passive maker exposure on NVDA when XGBoost toxicity > 54%.",
        },
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["added_memory"]["memory_id"].startswith("MEM-")

    act_resp = client.post(
        "/api/v1/ai/copilot",
        json={
            "query": "Remember our desk rule to always calibrate lambda=0.0014 and commit this trade to the blotter.",
            "tier": "auto",
        },
    )
    assert act_resp.status_code == 200
    act_data = act_resp.json()
    assert len(act_data.get("executed_actions", [])) >= 1
    assert len(act_data.get("recalled_memories", [])) >= 1


def test_tavily_financial_search_and_extract_endpoints():
    """Verify POST /api/v1/ai/tavily-search and /api/v1/ai/tavily-extract return cited intelligence and extracted content."""
    s_resp = client.post(
        "/api/v1/ai/tavily-search",
        json={"symbol": "NVDA", "topic": "finance", "search_depth": "basic", "max_results": 3},
    )
    assert s_resp.status_code == 200
    s_data = s_resp.json()
    assert s_data["symbol"] == "NVDA"
    assert len(s_data["citations"]) >= 1
    assert "catalyst_regime" in s_data
    assert "recommended_params" in s_data

    e_resp = client.post(
        "/api/v1/ai/tavily-extract",
        json={"url": s_data["citations"][0]["url"]},
    )
    assert e_resp.status_code == 200
    e_data = e_resp.json()
    assert len(e_data["extracted_content"]) > 10


def test_user_registration_welcome_email_and_isolated_portfolio():
    """Verify new user registration delivers welcome email and provisions an isolated $25M portfolio & blotter."""
    import time

    unique_email = f"quant.desk.{int(time.time() * 1000)}@institution.com"
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "InitialPassword!2026",
            "full_name": "Jordan Sterling",
            "organization": "Citadel Quant Strategies",
            "title": "Portfolio Execution Lead",
            "role": "trader",
        },
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert reg_data["user"]["email"] == unique_email
    assert reg_data.get("email_notification") is not None
    assert reg_data["email_notification"]["category"] in ("onboarding", "welcome")
    assert reg_data["email_notification"]["to"] == unique_email
    token = reg_data["token"]

    # Verify new user has their own isolated $25M baseline portfolio (6 seeded trades)
    port_a = client.get(
        f"/api/v1/portfolio?user_email={unique_email}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert port_a.status_code == 200
    port_a_data = port_a.json()
    assert port_a_data["account_owner_email"] == unique_email
    initial_count_a = port_a_data["summary"]["total_trades_count"]
    assert initial_count_a >= 6
    assert all(t["user_email"] == unique_email for t in port_a_data["trades"])

    # Execute a new trade for User A
    trade_resp = client.post(
        "/api/v1/portfolio/trade",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "symbol": "AAPL",
            "side": "buy",
            "quantity": 350,
            "scenario": "normal_market",
            "horizon_sec": 60,
            "user_email": unique_email,
        },
    )
    assert trade_resp.status_code == 200
    trade_data = trade_resp.json()
    assert trade_data["trade"]["user_email"] == unique_email
    assert trade_data["portfolio"]["summary"]["total_trades_count"] == initial_count_a + 1

    # Verify User B (admin@fasttrade.ai) does NOT see User A's trade in their portfolio
    port_b = client.get("/api/v1/portfolio?user_email=admin@fasttrade.ai")
    assert port_b.status_code == 200
    port_b_data = port_b.json()
    assert port_b_data["account_owner_email"] == "admin@fasttrade.ai"
    assert all(t["user_email"] == "admin@fasttrade.ai" for t in port_b_data["trades"])
    assert trade_data["trade"]["trade_id"] not in {t["trade_id"] for t in port_b_data["trades"]}


def test_forgot_password_email_code_and_reset_flow():
    """Verify Forgot Password sends 6-digit recovery code by email and Reset Password updates credentials."""
    import sqlite3
    import time
    from services.auth_service import DB_PATH

    unique_email = f"recovery.user.{int(time.time() * 1000)}@institution.com"
    client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "OldPassword!123",
            "full_name": "Elena Recovery",
            "organization": "AQR Capital",
            "title": "Execution Quant",
            "role": "trader",
        },
    )

    forgot_resp = client.post("/api/v1/auth/forgot-password", json={"email": unique_email})
    assert forgot_resp.status_code == 200
    forgot_data = forgot_resp.json()
    assert forgot_data["ok"] is True
    assert forgot_data["email"] == unique_email
    assert forgot_data["reset_token"].startswith("rst_")
    assert forgot_data["email_notification"]["category"] == "password_reset"

    # Retrieve the generated 6-digit code from the local password_resets table for test verification
    conn = sqlite3.connect(str(DB_PATH))
    row = conn.execute(
        "SELECT reset_code FROM password_resets WHERE email = ? ORDER BY id DESC LIMIT 1",
        (unique_email,),
    ).fetchone()
    conn.close()
    assert row is not None
    reset_code = row[0]
    assert len(reset_code) == 6

    # Reset password using the 6-digit code
    reset_resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": unique_email,
            "reset_code": reset_code,
            "new_password": "BrandNewPassword!999",
            "reset_token": forgot_data["reset_token"],
        },
    )
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["user"]["email"] == unique_email
    assert reset_data["token"].startswith("ft_")

    # Verify login works with the new password and fails with the old password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "OldPassword!123"},
    )
    assert bad_login.status_code == 401

    good_login = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "BrandNewPassword!999"},
    )
    assert good_login.status_code == 200


def test_profile_update_and_change_password():
    """Verify authenticated user can update profile details, preferences, and change password."""
    import time

    unique_email = f"profile.user.{int(time.time() * 1000)}@institution.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": unique_email,
            "password": "StartPassword!111",
            "full_name": "Marcus Vance",
            "organization": "Two Sigma",
            "title": "VP Execution",
            "role": "trader",
        },
    ).json()
    token = reg["token"]

    # Update profile details and preferences
    prof_resp = client.put(
        "/api/v1/auth/profile",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "full_name": "Marcus Vance, PhD",
            "title": "Managing Director, Execution Research",
            "organization": "Two Sigma Investments",
            "preferences": {"default_order_size": 2500, "risk_high_threshold": 0.55},
            "send_confirmation_email": True,
        },
    )
    assert prof_resp.status_code == 200
    prof_data = prof_resp.json()
    assert prof_data["user"]["full_name"] == "Marcus Vance, PhD"
    assert prof_data["user"]["preferences"]["default_order_size"] == 2500

    # Change password via POST /api/v1/auth/change-password
    chg_resp = client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "StartPassword!111",
            "new_password": "UpdatedPassword!222",
        },
    )
    assert chg_resp.status_code == 200
    assert chg_resp.json()["ok"] is True

    # Verify login with updated password
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email, "password": "UpdatedPassword!222"},
    )
    assert login_resp.status_code == 200


def test_nebius_sandboxes_status_and_coding_metadata():
    """Verify Nebius Token Factory Sandboxes Beta (`contree-sdk`) status and Coding Agent metadata."""
    st_resp = client.get("/api/v1/ai/status")
    assert st_resp.status_code == 200
    st_data = st_resp.json()
    assert "nebius_sandboxes" in st_data
    sb = st_data["nebius_sandboxes"]
    assert sb["sdk_installed"] is True
    assert sb["base_image"] == "python:3.12-slim"
    assert "limits" in sb

    sb_probe = client.get("/api/v1/ai/sandbox-status")
    assert sb_probe.status_code == 200
    sb_probe_data = sb_probe.json()
    assert sb_probe_data["sdk_installed"] is True
    assert sb_probe_data["endpoint"] == "https://api.tokenfactory.nebius.com/sandboxes"

    coding_resp = client.post(
        "/api/v1/ai/coding-agent",
        json={"prompt": "Synthesize adaptive Almgren-Chriss policy with OFI skew."},
    )
    assert coding_resp.status_code == 200
    coding_data = coding_resp.json()
    assert "nebius_sandbox" in coding_data
    assert coding_data["nebius_sandbox"]["base_image"] == "python:3.12-slim"


def test_langsmith_observability_status_and_trace_fields():
    """Verify LangSmith observability status endpoint and trace metadata fields across AI workflows."""
    st_resp = client.get("/api/v1/ai/status")
    assert st_resp.status_code == 200
    st_data = st_resp.json()
    assert "langsmith" in st_data
    ls_info = st_data["langsmith"]
    assert ls_info["sdk_installed"] is True
    assert ls_info["project_name"] == "FastTrade-Nebius-EMS"

    ls_direct = client.get("/api/v1/ai/langsmith-status")
    assert ls_direct.status_code == 200
    assert ls_direct.json()["sdk_installed"] is True

    wf_resp = client.post("/api/v1/ai/agent-workflow", json={"auto_commit_trade": False})
    assert wf_resp.status_code == 200
    assert "langsmith_trace_id" in wf_resp.json()



