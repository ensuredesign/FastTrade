"""Nebius Token Factory + NVIDIA Nemotron Multi-Tier Agentic Engine for FastTrade.

Implements genuine Model-Tier Routing across NVIDIA open-source Nemotron 3 models
hosted on Nebius Token Factory (https://api.tokenfactory.nebius.com/v1):

- Tier 1 (FAST / TACTICAL): ``nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B``
  Sub-second real-time microstructure anomaly detection, order-book toxicity
  alerts, and live SOR decision explanations.
- Tier 2 (BALANCED / COPILOT): ``nvidia/nemotron-3-super-120b-a12b``
  Interactive institutional execution copilot, what-if stress testing, and
  Almgren-Chriss parameter calibration advisory with chain-of-thought reasoning.
- Tier 3 (ULTRA / DEEP AUDIT): ``nvidia/Nemotron-3-Ultra-550b-a55b``
  Flagship 550B MoE model for Institutional Pre-Trade & Post-Trade Transaction
  Cost Analysis (TCA) Executive Committee reports and regulatory audit memos.
"""

from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

from services.langsmith_service import langsmith_service


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE_PATH = PROJECT_ROOT / ".env"

TierName = Literal["fast", "balanced", "ultra", "auto"]


def _load_dotenv_if_present(dotenv_path: Path = ENV_FILE_PATH) -> None:
    """Load key=value pairs from .env into os.environ without overriding existing vars."""
    if not dotenv_path.exists():
        return
    try:
        for raw_line in dotenv_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val
    except Exception:
        pass


_load_dotenv_if_present()


@dataclass
class NebiusModelTier:
    tier_id: Literal["fast", "balanced", "ultra"]
    model_id: str
    display_name: str
    architecture: str
    use_case: str
    target_latency_ms: int


@dataclass
class NebiusTelemetry:
    total_requests: int = 0
    successful_requests: int = 0
    fallback_requests: int = 0
    last_model_used: Optional[str] = None
    last_tier_used: Optional[str] = None
    last_latency_ms: Optional[float] = None
    total_latency_ms: float = 0.0
    tier_counts: Dict[str, int] = field(
        default_factory=lambda: {"fast": 0, "balanced": 0, "ultra": 0}
    )

    @property
    def avg_latency_ms(self) -> Optional[float]:
        if self.successful_requests == 0:
            return None
        return round(self.total_latency_ms / self.successful_requests, 1)


class NebiusAIService:
    """Multi-tier NVIDIA Nemotron agentic service powered by Nebius Token Factory."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_sec: float = 25.0,
    ) -> None:
        _load_dotenv_if_present()
        self.api_key = (
            api_key
            or os.environ.get("NEBIUS_API_KEY")
            or os.environ.get("FASTTRADE_FORECAST_API_KEY")
            or ""
        ).strip()
        self.base_url = (
            base_url
            or os.environ.get("NEBIUS_BASE_URL")
            or "https://api.tokenfactory.nebius.com/v1"
        ).rstrip("/")
        self.timeout_sec = timeout_sec

        self.tiers: Dict[Literal["fast", "balanced", "ultra"], NebiusModelTier] = {
            "fast": NebiusModelTier(
                tier_id="fast",
                model_id=os.environ.get(
                    "NEBIUS_MODEL_FAST", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B"
                ),
                display_name="NVIDIA Nemotron-3 Nano 30B (A3B MoE)",
                architecture="30B Total / 3B Active MoE Hybrid Mamba-Transformer",
                use_case="Real-time L2 microstructure anomaly alerts & tactical routing briefs",
                target_latency_ms=950,
            ),
            "balanced": NebiusModelTier(
                tier_id="balanced",
                model_id=os.environ.get(
                    "NEBIUS_MODEL_BALANCED", "nvidia/nemotron-3-super-120b-a12b"
                ),
                display_name="NVIDIA Nemotron-3 Super 120B (A12B MoE)",
                architecture="120B Total / 12B Active Reasoning MoE",
                use_case="Interactive quantitative copilot, what-if shock simulation & parameter tuning",
                target_latency_ms=1450,
            ),
            "ultra": NebiusModelTier(
                tier_id="ultra",
                model_id=os.environ.get(
                    "NEBIUS_MODEL_ULTRA", "nvidia/Nemotron-3-Ultra-550b-a55b"
                ),
                display_name="NVIDIA Nemotron-3 Ultra 550B (A55B MoE)",
                architecture="550B Total / 55B Active Flagship Reasoning MoE",
                use_case="Institutional Post-Trade TCA committee audit & multi-strategy attribution",
                target_latency_ms=1800,
            ),
        }
        self.telemetry = NebiusTelemetry()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and not self.api_key.startswith("your_"))

    def route_tier(
        self,
        task_type: Literal["tactical_brief", "copilot", "tca_report", "shock_sim"],
        query: str = "",
        requested_tier: TierName = "auto",
    ) -> Tuple[NebiusModelTier, str]:
        """Select the optimal NVIDIA Nemotron model tier and explain why."""
        if requested_tier in ("fast", "balanced", "ultra"):
            tier = self.tiers[requested_tier]
            return (
                tier,
                f"Explicitly routed to {tier.display_name} ({requested_tier.upper()} tier) per operator override.",
            )

        if task_type == "tactical_brief":
            tier = self.tiers["fast"]
            return (
                tier,
                "Auto-routed to FAST tier (Nemotron-3 Nano 30B-A3B) for sub-second L2 order-book and toxicity telemetry synthesis.",
            )

        if task_type == "tca_report":
            tier = self.tiers["ultra"]
            return (
                tier,
                "Auto-routed to ULTRA tier (Nemotron-3 Ultra 550B-A55B) for deep institutional Transaction Cost Analysis (TCA) and multi-strategy attribution.",
            )

        if task_type == "shock_sim":
            tier = self.tiers["balanced"]
            return (
                tier,
                "Auto-routed to BALANCED tier (Nemotron-3 Super 120B-A12B) for counterfactual market regime stress-testing and Almgren-Chriss re-calibration.",
            )

        # Dynamic query complexity classification for interactive copilot
        q_lower = query.lower()
        ultra_keywords = (
            "tca",
            "audit",
            "compliance",
            "committee",
            "compare all",
            "full report",
            "attribution",
            "mathematical proof",
            "derive",
            "executive memo",
        )
        fast_keywords = (
            "current spread",
            "what is the price",
            "quick",
            "status",
            "current action",
            "last fill",
            "tldr",
            "summary",
        )

        if any(k in q_lower for k in ultra_keywords) or len(query) > 220:
            tier = self.tiers["ultra"]
            return (
                tier,
                "Auto-routed to ULTRA tier (Nemotron-3 Ultra 550B-A55B) due to high analytical complexity / institutional audit depth.",
            )
        if any(k in q_lower for k in fast_keywords) and len(query) < 90:
            tier = self.tiers["fast"]
            return (
                tier,
                "Auto-routed to FAST tier (Nemotron-3 Nano 30B-A3B) for low-latency real-time telemetry lookup.",
            )

        tier = self.tiers["balanced"]
        return (
            tier,
            "Auto-routed to BALANCED tier (Nemotron-3 Super 120B-A12B) for multi-factor microstructure & execution reasoning.",
        )

    def _call_nebius_chat(
        self,
        model_id: str,
        tier_id: Literal["fast", "balanced", "ultra"],
        messages: List[Dict[str, str]],
        max_tokens: int = 700,
        temperature: float = 0.2,
    ) -> Tuple[Optional[str], Optional[str], float, Optional[str]]:
        """Invoke Nebius Token Factory OpenAI-compatible /v1/chat/completions endpoint.

        Returns (content, reasoning_content, latency_ms, error_message).
        """
        self.telemetry.total_requests += 1
        t0 = time.perf_counter()

        if not self.is_configured:
            self.telemetry.fallback_requests += 1
            return None, None, 0.0, "nebius_api_key_not_configured"

        url = f"{self.base_url}/chat/completions"
        payload = json.dumps(
            {
                "model": model_id,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "FastTrade-Institutional-SOR/2.0 (Nebius-NVIDIA)",
            },
            method="POST",
        )

        try:
            with langsmith_service.trace_span(
                name=f"NebiusTokenFactory.{tier_id.upper()}.{model_id.split('/')[-1]}",
                run_type="llm",
                inputs={"messages": messages, "model": model_id, "max_tokens": max_tokens, "temperature": temperature},
                tags=["nvidia-nemotron-3", f"tier:{tier_id}"],
                metadata={
                    "ls_provider": "nebius-token-factory",
                    "ls_model_name": model_id,
                    "ls_model_type": "chat",
                    "ls_temperature": temperature,
                    "ls_max_tokens": max_tokens,
                },
            ) as llm_span:
                with urllib.request.urlopen(req, timeout=self.timeout_sec) as resp:
                    raw_body = resp.read().decode("utf-8")
                    data = json.loads(raw_body)
                    latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)

                    choice = (data.get("choices") or [{}])[0]
                    msg = choice.get("message") or {}
                    content = (msg.get("content") or "").strip()
                    reasoning = (msg.get("reasoning_content") or "").strip() or None

                    # If a thinking model put everything in reasoning_content when max_tokens was tight
                    if not content and reasoning:
                        content = reasoning

                    self.telemetry.successful_requests += 1
                    self.telemetry.last_model_used = model_id
                    self.telemetry.last_tier_used = tier_id
                    self.telemetry.last_latency_ms = latency_ms
                    self.telemetry.total_latency_ms += latency_ms
                    self.telemetry.tier_counts[tier_id] = (
                        self.telemetry.tier_counts.get(tier_id, 0) + 1
                    )
                    llm_span.set_outputs(
                        {
                            "choices": [{"message": {"role": "assistant", "content": content, "reasoning_content": reasoning}}],
                            "usage": data.get("usage") or {},
                            "latency_ms": latency_ms,
                        }
                    )
                    return content, reasoning, latency_ms, None

        except urllib.error.HTTPError as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            self.telemetry.fallback_requests += 1
            return None, None, latency_ms, f"http_{exc.code}"
        except Exception as exc:
            latency_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            self.telemetry.fallback_requests += 1
            return None, None, latency_ms, f"{type(exc).__name__}: {exc}"

    @staticmethod
    def _summarize_snapshot_context(snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """Extract exact numerical metrics from DashboardSnapshot for zero-hallucination prompting."""
        market = snapshot.get("market") or {}
        execution = snapshot.get("execution") or {}
        risk = snapshot.get("risk") or {}
        ac = snapshot.get("ac_schedule") or {}
        forecast = snapshot.get("forecast") or {}
        perf = snapshot.get("performance") or {}
        features = snapshot.get("features") or {}

        feat_points = features.get("points") or []
        latest_feat = feat_points[-1] if feat_points else {}

        perf_results = {
            r.get("strategy"): r for r in (perf.get("results") or []) if isinstance(r, dict)
        }
        sf_perf = perf_results.get("fasttrade") or perf_results.get("proposed") or {}
        twap_perf = perf_results.get("twap") or {}
        vwap_perf = perf_results.get("vwap") or {}
        mkt_perf = perf_results.get("market") or {}
        ac_perf = perf_results.get("almgren_chriss") or {}

        mid_price = float(market.get("mid_price") or 100.0)
        target_qty = float(execution.get("target_quantity") or 1000.0)
        notional_usd = round(mid_price * target_qty, 2)

        sf_is_bps = float(sf_perf.get("implementation_shortfall_bps") or 0.0)
        twap_is_bps = float(twap_perf.get("implementation_shortfall_bps") or 0.0)
        vwap_is_bps = float(vwap_perf.get("implementation_shortfall_bps") or 0.0)
        mkt_is_bps = float(mkt_perf.get("implementation_shortfall_bps") or 0.0)

        savings_vs_twap_bps = round(twap_is_bps - sf_is_bps, 2)
        savings_vs_twap_usd = round((savings_vs_twap_bps / 10000.0) * notional_usd, 2)
        savings_vs_mkt_bps = round(mkt_is_bps - sf_is_bps, 2)
        savings_vs_mkt_usd = round((savings_vs_mkt_bps / 10000.0) * notional_usd, 2)

        # Count actions across trajectory
        trajectory = execution.get("trajectory") or []
        action_counts = {"passive": 0, "aggressive": 0, "wait": 0}
        for pt in trajectory:
            act = pt.get("action", "passive")
            if act in action_counts:
                action_counts[act] += 1

        f_points = forecast.get("points") or []
        last_reason = f_points[-1].get("decision_reason", "") if f_points else ""

        return {
            "scenario": snapshot.get("scenario") or "normal_market",
            "symbol": market.get("symbol") or "BTC-USD",
            "mid_price": mid_price,
            "spread": float(market.get("spread") or 0.05),
            "spread_bps": round(float(latest_feat.get("spread_bps") or 5.0), 2),
            "depth_imbalance_l1": round(float(market.get("order_flow_imbalance") or 0.0), 4),
            "ofi_instant": round(float(latest_feat.get("ofi_instant") or 0.0), 2),
            "volatility_std_10": round(float(latest_feat.get("volatility_std_10") or 0.0), 6),
            "total_bid_depth": round(float(latest_feat.get("total_bid_depth") or 0.0), 1),
            "total_ask_depth": round(float(latest_feat.get("total_ask_depth") or 0.0), 1),
            "order_id": execution.get("order_id") or "ORD-FASTTRADE",
            "side": (execution.get("side") or "buy").upper(),
            "target_quantity": target_qty,
            "filled_quantity": float(execution.get("filled_quantity") or 0.0),
            "remaining_quantity": float(execution.get("remaining_quantity") or 0.0),
            "notional_usd": notional_usd,
            "selected_action": execution.get("selected_action") or "passive",
            "urgency_score": float(execution.get("execution_score") or 0.0),
            "action_counts": action_counts,
            "adverse_selection_prob": round(
                float(risk.get("adverse_selection_probability") or 0.0), 4
            ),
            "adverse_model_name": risk.get("model_name") or "XGBoost Calibrated",
            "ac_expected_cost_usd": float(ac.get("expected_cost") or 0.0),
            "ac_utility_cost": float(ac.get("utility_cost") or 0.0),
            "ac_horizon_sec": float(ac.get("horizon_sec") or 60.0),
            "last_decision_reason": last_reason,
            "fasttrade_is_bps": sf_is_bps,
            "twap_is_bps": twap_is_bps,
            "vwap_is_bps": vwap_is_bps,
            "market_is_bps": mkt_is_bps,
            "ac_is_bps": float(ac_perf.get("implementation_shortfall_bps") or 0.0),
            "savings_vs_twap_bps": savings_vs_twap_bps,
            "savings_vs_twap_usd": savings_vs_twap_usd,
            "savings_vs_mkt_bps": savings_vs_mkt_bps,
            "savings_vs_mkt_usd": savings_vs_mkt_usd,
            "all_strategies": perf.get("results") or [],
        }

    def generate_tactical_brief(
        self, snapshot: Dict[str, Any], tier_override: TierName = "auto"
    ) -> Dict[str, Any]:
        """Generate a real-time tactical desk brief using Tier 1 (Nemotron-3 Nano 30B)."""
        ctx = self._summarize_snapshot_context(snapshot)
        tier, routing_reason = self.route_tier(
            "tactical_brief", requested_tier=tier_override
        )

        system_prompt = (
            "You are FastTrade's Institutional Quantitative Execution Desk AI powered by NVIDIA Nemotron on Nebius Token Factory. "
            "Respond ONLY with a valid JSON object (no markdown fences, no extra prose) containing exactly these 5 string keys:\n"
            '{"headline": "...", "regime_assessment": "...", "routing_rationale": "...", "alpha_highlight": "...", "risk_guardrail": "..."}\n'
            "Use the exact numbers provided. Keep each field concise (1-2 sharp institutional sentences)."
        )
        user_prompt = (
            f"Live Simulation Snapshot ({ctx['scenario']}):\n"
            f"- Instrument: {ctx['symbol']} | Side: {ctx['side']} | Target Qty: {ctx['target_quantity']} ({ctx['notional_usd']} USD notional)\n"
            f"- Mid Price: ${ctx['mid_price']} | Spread: ${ctx['spread']} ({ctx['spread_bps']} bps)\n"
            f"- L1 Depth Imbalance: {ctx['depth_imbalance_l1']} | Instantaneous OFI: {ctx['ofi_instant']} | Bid/Ask Depth: {ctx['total_bid_depth']} / {ctx['total_ask_depth']}\n"
            f"- Adverse Selection Risk Probability ({ctx['adverse_model_name']}): {ctx['adverse_selection_prob'] * 100:.1f}%\n"
            f"- Current Selected Action: {ctx['selected_action'].upper()} | Urgency: {ctx['urgency_score'] * 100:.0f}% | Action Mix: {ctx['action_counts']}\n"
            f"- Engine Decision Trace: {ctx['last_decision_reason']}\n"
            f"- Performance (Implementation Shortfall): FastTrade={ctx['fasttrade_is_bps']} bps vs TWAP={ctx['twap_is_bps']} bps, VWAP={ctx['vwap_is_bps']} bps, Market={ctx['market_is_bps']} bps, Almgren-Chriss={ctx['ac_is_bps']} bps.\n"
            f"- Alpha Saved vs TWAP: {ctx['savings_vs_twap_bps']} bps (${ctx['savings_vs_twap_usd']})."
        )

        with langsmith_service.trace_span(
            name="FastTrade.TacticalDeskBrief",
            run_type="chain",
            inputs={"symbol": ctx["symbol"], "scenario": ctx["scenario"], "tier": tier.tier_id},
            tags=["tactical-brief", f"symbol:{ctx['symbol']}"],
        ) as brief_span:
            content, reasoning, latency_ms, err = self._call_nebius_chat(
                model_id=tier.model_id,
                tier_id=tier.tier_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1100,
                temperature=0.15,
            )

            parsed = self._parse_json_object(content) if content else None
            if parsed and all(
                k in parsed
                for k in (
                    "headline",
                    "regime_assessment",
                    "routing_rationale",
                    "alpha_highlight",
                    "risk_guardrail",
                )
            ):
                out_payload = {
                    "status": "live_nebius",
                    "provider": "Nebius Token Factory",
                    "tier": tier.tier_id,
                    "model_id": tier.model_id,
                    "model_display_name": tier.display_name,
                    "routing_reason": routing_reason,
                    "latency_ms": latency_ms,
                    "headline": str(parsed["headline"]),
                    "regime_assessment": str(parsed["regime_assessment"]),
                    "routing_rationale": str(parsed["routing_rationale"]),
                    "alpha_highlight": str(parsed["alpha_highlight"]),
                    "risk_guardrail": str(parsed["risk_guardrail"]),
                    "reasoning_trace": reasoning,
                    "langsmith_trace_id": brief_span.trace_id,
                    "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                }
                brief_span.set_outputs({"headline": out_payload["headline"], "model_id": tier.model_id})
                return out_payload

            # Deterministic quantitative fallback if offline or non-JSON
            fb = self._fallback_tactical_brief(ctx, tier, routing_reason, latency_ms, content, reasoning, err)
            fb["langsmith_trace_id"] = brief_span.trace_id
            brief_span.set_outputs({"headline": fb["headline"], "status": fb["status"]})
            return fb

    def generate_tca_report(
        self, snapshot: Dict[str, Any], tier_override: TierName = "auto"
    ) -> Dict[str, Any]:
        """Generate an Institutional Post-Trade TCA Executive Memo using Tier 3 (Nemotron-3 Ultra 550B)."""
        ctx = self._summarize_snapshot_context(snapshot)
        tier, routing_reason = self.route_tier(
            "tca_report", requested_tier=tier_override
        )

        strat_lines = "\n".join(
            f"  * {s.get('strategy', '').upper()}: Fill Rate={float(s.get('fill_rate', 0))*100:.1f}%, "
            f"Shortfall={s.get('implementation_shortfall_bps')} bps, "
            f"Slippage={s.get('slippage_bps')} bps, Impact={s.get('market_impact_bps')} bps, "
            f"Adverse Selection={s.get('adverse_selection_bps')} bps"
            for s in ctx["all_strategies"]
        )

        system_prompt = (
            "You are the Chief Quantitative Execution Officer & TCA Audit Engine powered by NVIDIA Nemotron-3 Ultra 550B on Nebius Token Factory. "
            "Produce a concise, authoritative Institutional Post-Trade Transaction Cost Analysis (TCA) Executive Memo in Markdown format. "
            "Structure with exact sections:\n"
            "1. **Executive Summary & Execution Verdict**\n"
            "2. **Microstructure & Adverse-Selection Toxicity Attribution**\n"
            "3. **Almgren-Chriss Optimal Trajectory vs. Realized Slicing**\n"
            "4. **Multi-Strategy Benchmark Alpha Table Analysis**\n"
            "5. **Desk Risk & Parameter Recommendations**\n"
            "Use only the exact simulation metrics provided."
        )
        user_prompt = (
            f"Generate the Institutional Post-Trade TCA Report for Order {ctx['order_id']}:\n"
            f"- Scenario Regime: {ctx['scenario']} | Symbol: {ctx['symbol']} | Side: {ctx['side']}\n"
            f"- Target Quantity: {ctx['target_quantity']} units | Filled: {ctx['filled_quantity']} units | Notional: ${ctx['notional_usd']:,.2f}\n"
            f"- Market State: Mid=${ctx['mid_price']}, Spread=${ctx['spread']} ({ctx['spread_bps']} bps), L1 Imbalance={ctx['depth_imbalance_l1']}, OFI={ctx['ofi_instant']}\n"
            f"- ML Adverse-Selection Risk ({ctx['adverse_model_name']}): {ctx['adverse_selection_prob']*100:.1f}%\n"
            f"- Almgren-Chriss Baseline: Horizon={ctx['ac_horizon_sec']}s, Expected Cost=${ctx['ac_expected_cost_usd']:.2f}, Utility Cost={ctx['ac_utility_cost']:.2f}\n"
            f"- Realized Action Distribution: Passive={ctx['action_counts']['passive']}, Aggressive={ctx['action_counts']['aggressive']}, Hold/Wait={ctx['action_counts']['wait']}\n"
            f"- Six-Strategy Identical-Replay Benchmark:\n{strat_lines}\n"
            f"- Net Alpha vs TWAP: {ctx['savings_vs_twap_bps']} bps (${ctx['savings_vs_twap_usd']:,.2f}) | vs Market Sweep: {ctx['savings_vs_mkt_bps']} bps (${ctx['savings_vs_mkt_usd']:,.2f})."
        )

        with langsmith_service.trace_span(
            name="FastTrade.ExecutiveTCAAudit",
            run_type="chain",
            inputs={"order_id": ctx["order_id"], "symbol": ctx["symbol"], "scenario": ctx["scenario"], "tier": tier.tier_id},
            tags=["tca-audit", "ultra-550b", f"symbol:{ctx['symbol']}"],
        ) as tca_span:
            content, reasoning, latency_ms, err = self._call_nebius_chat(
                model_id=tier.model_id,
                tier_id=tier.tier_id,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1600,
                temperature=0.2,
            )

            if not content:
                content = self._fallback_tca_markdown(ctx)
                status = f"fallback ({err or 'offline'})"
            else:
                status = "live_nebius"

            out_tca = {
                "status": status,
                "provider": "Nebius Token Factory",
                "tier": tier.tier_id,
                "model_id": tier.model_id,
                "model_display_name": tier.display_name,
                "routing_reason": routing_reason,
                "latency_ms": latency_ms,
                "order_id": ctx["order_id"],
                "scenario": ctx["scenario"],
                "notional_usd": ctx["notional_usd"],
                "fasttrade_shortfall_bps": ctx["fasttrade_is_bps"],
                "savings_vs_twap_bps": ctx["savings_vs_twap_bps"],
                "savings_vs_twap_usd": ctx["savings_vs_twap_usd"],
                "savings_vs_market_bps": ctx["savings_vs_mkt_bps"],
                "savings_vs_market_usd": ctx["savings_vs_mkt_usd"],
                "report_markdown": content,
                "reasoning_trace": reasoning,
                "langsmith_trace_id": tca_span.trace_id,
                "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
            tca_span.set_outputs({"order_id": ctx["order_id"], "savings_vs_twap_bps": ctx["savings_vs_twap_bps"], "status": status})
            return out_tca

    def ask_copilot(
        self,
        query: str,
        snapshot: Dict[str, Any],
        tier_override: TierName = "auto",
    ) -> Dict[str, Any]:
        """Interactive quantitative execution copilot using dynamic Model-Tier Routing."""
        ctx = self._summarize_snapshot_context(snapshot)
        tier, routing_reason = self.route_tier(
            "copilot", query=query, requested_tier=tier_override
        )

        strat_summary = ", ".join(
            f"{s.get('strategy')}: {s.get('implementation_shortfall_bps')} bps"
            for s in ctx["all_strategies"]
        )

        system_prompt = (
            f"You are FastTrade Copilot, an institutional quantitative execution agent running on {tier.display_name} via Nebius Token Factory. "
            "Answer the trader's question directly, quantitatively, and concisely using the live order book, ML adverse selection, and Almgren-Chriss telemetry provided. "
            "Format key metrics in bold. Never fabricate numbers outside the telemetry."
        )
        user_prompt = (
            f"Live Telemetry Context:\n"
            f"- Scenario: {ctx['scenario']} | Order: {ctx['side']} {ctx['target_quantity']} {ctx['symbol']} (Filled: {ctx['filled_quantity']}, Notional: ${ctx['notional_usd']:,.2f})\n"
            f"- Market: Mid=${ctx['mid_price']}, Spread={ctx['spread_bps']} bps, L1 Imbalance={ctx['depth_imbalance_l1']}, OFI={ctx['ofi_instant']}, Bid/Ask Depth={ctx['total_bid_depth']}/{ctx['total_ask_depth']}\n"
            f"- Toxicity Risk ({ctx['adverse_model_name']}): {ctx['adverse_selection_prob']*100:.1f}% | Selected Action: {ctx['selected_action'].upper()} | Urgency: {ctx['urgency_score']*100:.0f}%\n"
            f"- Action Mix: Passive={ctx['action_counts']['passive']}, Aggressive={ctx['action_counts']['aggressive']}, Wait={ctx['action_counts']['wait']}\n"
            f"- Latest Engine Reason: {ctx['last_decision_reason']}\n"
            f"- Implementation Shortfall Benchmarks: {strat_summary}\n\n"
            f"Trader Question: {query}"
        )

        content, reasoning, latency_ms, err = self._call_nebius_chat(
            model_id=tier.model_id,
            tier_id=tier.tier_id,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=1200,
            temperature=0.2,
        )

        if not content:
            content = (
                f"**[Deterministic Quant Analysis]** In the **{ctx['scenario']}** regime for **{ctx['side']} {ctx['target_quantity']} {ctx['symbol']}**, "
                f"FastTrade recorded an Implementation Shortfall of **{ctx['fasttrade_is_bps']} bps** vs. **{ctx['twap_is_bps']} bps** for TWAP "
                f"(saving **{ctx['savings_vs_twap_bps']} bps / ${ctx['savings_vs_twap_usd']:,.2f}**). "
                f"Current adverse-selection probability is **{ctx['adverse_selection_prob']*100:.1f}%** with L1 depth imbalance at **{ctx['depth_imbalance_l1']}**, "
                f"driving a **{ctx['selected_action'].upper()}** routing posture."
            )
            status = f"fallback ({err or 'offline'})"
        else:
            status = "live_nebius"

        return {
            "status": status,
            "provider": "Nebius Token Factory",
            "tier": tier.tier_id,
            "model_id": tier.model_id,
            "model_display_name": tier.display_name,
            "routing_reason": routing_reason,
            "latency_ms": latency_ms,
            "query": query,
            "answer": content,
            "reasoning_trace": reasoning,
            "suggested_followups": [
                "Why did FastTrade switch between passive maker and aggressive taker slices?",
                "How much alpha did we save vs TWAP and Market orders in USD and bps?",
                "How should we adjust Almgren-Chriss risk aversion (λ) if toxicity spikes above 75%?",
            ],
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    def get_status(self) -> Dict[str, Any]:
        """Return Nebius Token Factory connection metadata and NVIDIA model tier registry."""
        return {
            "configured": self.is_configured,
            "provider": "Nebius Token Factory",
            "base_url": self.base_url,
            "nvidia_model_tiers": [
                {
                    "tier_id": t.tier_id,
                    "model_id": t.model_id,
                    "display_name": t.display_name,
                    "architecture": t.architecture,
                    "use_case": t.use_case,
                    "target_latency_ms": t.target_latency_ms,
                }
                for t in self.tiers.values()
            ],
            "telemetry": {
                "total_requests": self.telemetry.total_requests,
                "successful_requests": self.telemetry.successful_requests,
                "fallback_requests": self.telemetry.fallback_requests,
                "avg_latency_ms": self.telemetry.avg_latency_ms,
                "last_model_used": self.telemetry.last_model_used,
                "last_tier_used": self.telemetry.last_tier_used,
                "last_latency_ms": self.telemetry.last_latency_ms,
                "tier_counts": self.telemetry.tier_counts,
            },
        }

    @staticmethod
    def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            return None
        try:
            obj = json.loads(match.group(0))
            return obj if isinstance(obj, dict) else None
        except Exception:
            return None

    @staticmethod
    def _fallback_tactical_brief(
        ctx: Dict[str, Any],
        tier: NebiusModelTier,
        routing_reason: str,
        latency_ms: float,
        raw_content: Optional[str],
        reasoning: Optional[str],
        err: Optional[str],
    ) -> Dict[str, Any]:
        tox_pct = ctx["adverse_selection_prob"] * 100.0
        regime = (
            "Elevated Informed Flow Toxicity"
            if tox_pct >= 65.0
            else "Low-Toxicity Passive Maker Window"
            if tox_pct <= 35.0
            else "Balanced Almgren-Chriss Trajectory"
        )
        return {
            "status": "live_nebius" if raw_content else f"deterministic_fallback ({err or 'offline'})",
            "provider": "Nebius Token Factory",
            "tier": tier.tier_id,
            "model_id": tier.model_id,
            "model_display_name": tier.display_name,
            "routing_reason": routing_reason,
            "latency_ms": latency_ms,
            "headline": f"{ctx['symbol']} {ctx['side']} Execution — {regime} ({ctx['fasttrade_is_bps']} bps Shortfall)",
            "regime_assessment": (
                f"Mid-price at ${ctx['mid_price']} with {ctx['spread_bps']} bps spread and L1 depth imbalance of {ctx['depth_imbalance_l1']}. "
                f"XGBoost adverse-selection risk stands at {tox_pct:.1f}%."
            ),
            "routing_rationale": raw_content
            or (
                f"Engine selected {ctx['selected_action'].upper()} mode (Passive={ctx['action_counts']['passive']}, "
                f"Aggressive={ctx['action_counts']['aggressive']}, Wait={ctx['action_counts']['wait']}). {ctx['last_decision_reason']}"
            ),
            "alpha_highlight": (
                f"FastTrade realized {ctx['fasttrade_is_bps']} bps shortfall vs {ctx['twap_is_bps']} bps on TWAP, "
                f"preserving {ctx['savings_vs_twap_bps']} bps (${ctx['savings_vs_twap_usd']:,.2f}) on ${ctx['notional_usd']:,.2f} notional."
            ),
            "risk_guardrail": (
                "Withdraw resting passive limit orders immediately if 10-tick adverse-selection toxicity crosses 65% or completion urgency exceeds 75%."
            ),
            "reasoning_trace": reasoning,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }

    @staticmethod
    def _fallback_tca_markdown(ctx: Dict[str, Any]) -> str:
        return (
            f"### 1. Executive Summary & Execution Verdict\n"
            f"Order **{ctx['order_id']}** ({ctx['side']} **{ctx['target_quantity']} {ctx['symbol']}**, Notional **${ctx['notional_usd']:,.2f}**) "
            f"completed under the **{ctx['scenario']}** regime with a realized Implementation Shortfall of **{ctx['fasttrade_is_bps']} bps**, "
            f"outperforming TWAP (**{ctx['twap_is_bps']} bps**) by **{ctx['savings_vs_twap_bps']} bps (${ctx['savings_vs_twap_usd']:,.2f})**.\n\n"
            f"### 2. Microstructure & Adverse-Selection Toxicity Attribution\n"
            f"Terminal adverse-selection probability registered at **{ctx['adverse_selection_prob']*100:.1f}%** ({ctx['adverse_model_name']}) "
            f"with instantaneous OFI of **{ctx['ofi_instant']}** and L1 imbalance of **{ctx['depth_imbalance_l1']}**. "
            f"FastTrade dynamically modulated maker exposure ({ctx['action_counts']['passive']} passive, {ctx['action_counts']['aggressive']} aggressive, {ctx['action_counts']['wait']} hold decisions).\n\n"
            f"### 3. Almgren-Chriss Optimal Trajectory vs. Realized Slicing\n"
            f"Against the {ctx['ac_horizon_sec']}s Almgren-Chriss baseline (Expected Cost **${ctx['ac_expected_cost_usd']:.2f}**, Shortfall **{ctx['ac_is_bps']} bps**), "
            f"FastTrade opportunistically captured spread during low-toxicity windows while enforcing completion urgency guardrails.\n\n"
            f"### 4. Desk Risk & Parameter Recommendations\n"
            f"Maintain dynamic toxicity withdrawal threshold at **0.65** and urgency override at **0.75** for subsequent institutional parent orders."
        )


# Singleton instance for FastAPI routes
nebius_ai_service = NebiusAIService()
