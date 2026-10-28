"""FastAPI Routes for Nebius Token Factory + NVIDIA Nemotron Multi-Tier AI Copilot,
5-Stage Multi-Step Autonomous Workflow Agent, Self-Iterating Quant Coding Agent,
Tavily Live Financial Intelligence (`search` & `extract`), and Persistent Episodic Memory Engine.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.routes.dashboard import service as dashboard_service
from services.agent_workflows import agent_memory_store, agent_orchestrator
from services.langsmith_service import langsmith_service
from services.nebius_ai import nebius_ai_service, TierName
from services.nebius_sandbox_service import nebius_sandbox_service
from services.tavily_service import tavily_service

router = APIRouter(prefix="/api/v1/ai", tags=["Nebius NVIDIA Nemotron AI & Tavily Intelligence"])


class TacticalBriefRequest(BaseModel):
    tier: TierName = "auto"
    snapshot: Optional[Dict[str, Any]] = None


class TCAReportRequest(BaseModel):
    tier: TierName = "auto"
    snapshot: Optional[Dict[str, Any]] = None


class CopilotQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1500)
    tier: TierName = "auto"
    snapshot: Optional[Dict[str, Any]] = None
    user_email: str = "trader@fasttrade.ai"


class AgentWorkflowRequest(BaseModel):
    mission: str = Field(
        default="Execute full 5-stage autonomous order optimization, iterative sandbox backtest, CRO CaR audit, and live blotter commit.",
        max_length=1000,
    )
    auto_commit_trade: bool = True
    user_email: str = "trader@fasttrade.ai"
    snapshot: Optional[Dict[str, Any]] = None


class CodingAgentRequest(BaseModel):
    prompt: str = Field(
        default="Design an adaptive execution algorithm that dynamically skews passive limit orders using L1 Order Flow Imbalance (OFI) and halts maker posting when XGBoost toxicity > 54%.",
        min_length=4,
        max_length=1500,
    )
    snapshot: Optional[Dict[str, Any]] = None


class AddMemoryRequest(BaseModel):
    category: str = Field(default="OPERATOR_PREFERENCE", max_length=64)
    symbol_scope: str = Field(default="ALL", max_length=64)
    rule_summary: str = Field(..., min_length=4, max_length=1000)


class TavilySearchRequest(BaseModel):
    symbol: str = Field(default="NVDA", max_length=32)
    query: Optional[str] = Field(default=None, max_length=390)
    topic: Literal["finance", "news", "general"] = "finance"
    search_depth: Literal["ultra-fast", "fast", "basic", "advanced"] = "basic"
    max_results: int = Field(default=5, ge=1, le=10)


class TavilyExtractRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=1000)


class SandboxRunRequest(BaseModel):
    python_code: str = Field(..., min_length=2, max_length=15000)
    apt_packages: List[str] = Field(default_factory=list, max_length=10)
    pip_packages: List[str] = Field(default_factory=list, max_length=10)
    save_checkpoint: bool = True


def _resolve_snapshot_dict(provided_snapshot: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Use client-provided snapshot if present, otherwise pull current cached backend snapshot."""
    if provided_snapshot and isinstance(provided_snapshot, dict) and provided_snapshot.get("market"):
        return provided_snapshot
    snap_model = dashboard_service.get_snapshot(refresh=False)
    return snap_model.model_dump()


@router.get("/status")
def get_nebius_ai_status() -> Dict[str, Any]:
    """Return Nebius Token Factory status, NVIDIA Nemotron 3 model tiers, Sandboxes Beta, LangSmith, and routing telemetry."""
    status = nebius_ai_service.get_status()
    status["tavily_configured"] = tavily_service.is_configured
    status["nebius_sandboxes"] = nebius_sandbox_service.get_status()
    status["langsmith"] = langsmith_service.get_status()
    return status


@router.get("/langsmith-status")
def get_langsmith_observability_status() -> Dict[str, Any]:
    """Return live LangSmith observability status, project name, and recent traced run IDs."""
    return langsmith_service.get_status()


@router.post("/langsmith-share/{trace_id}")
def share_langsmith_trace(trace_id: str) -> Dict[str, Any]:
    """Publish a read-only LangSmith public trace link (`smith.langchain.com/public/.../r`) for judges & auditors."""
    try:
        return langsmith_service.share_trace_publicly(trace_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/sandbox-status")
def get_nebius_sandbox_status() -> Dict[str, Any]:
    """Return live Nebius Token Factory Sandboxes Beta (`contree-sdk`) readiness, permissions, and limits."""
    return nebius_sandbox_service.get_status(force_probe=True)


@router.post("/sandbox-run")
def execute_nebius_sandbox_code(req: SandboxRunRequest) -> Dict[str, Any]:
    """Execute Python code (with optional apt/pip setup) inside an isolated Nebius Sandbox VM (`python:3.12-slim`)."""
    try:
        return nebius_sandbox_service.execute_custom_sandbox_code(
            python_code=req.python_code,
            apt_packages=req.apt_packages,
            pip_packages=req.pip_packages,
            save_checkpoint=req.save_checkpoint,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Nebius Sandbox execution error: {exc}") from exc


@router.post("/tactical-brief")
def create_tactical_brief(req: TacticalBriefRequest) -> Dict[str, Any]:
    """Generate a real-time tactical execution desk brief via NVIDIA Nemotron-3 Nano 30B on Nebius."""
    snap_dict = _resolve_snapshot_dict(req.snapshot)
    return nebius_ai_service.generate_tactical_brief(snap_dict, tier_override=req.tier)


@router.post("/tca-report")
def create_tca_report(req: TCAReportRequest) -> Dict[str, Any]:
    """Generate an Institutional Post-Trade TCA Executive Memo via NVIDIA Nemotron-3 Ultra 550B on Nebius."""
    snap_dict = _resolve_snapshot_dict(req.snapshot)
    return nebius_ai_service.generate_tca_report(snap_dict, tier_override=req.tier)


@router.post("/copilot")
def ask_execution_copilot(req: CopilotQueryRequest) -> Dict[str, Any]:
    """Answer trader queries using dynamic Model-Tier Routing, persistent episodic memory, and real desk actions."""
    if not req.query.strip():
        raise HTTPException(status_code=422, detail="Query cannot be empty")
    snap_dict = _resolve_snapshot_dict(req.snapshot)
    return agent_orchestrator.ask_context_aware_copilot(
        query=req.query.strip(),
        snapshot=snap_dict,
        tier_override=req.tier,
        user_email=req.user_email,
    )


@router.post("/agent-workflow")
def execute_autonomous_workflow(req: AgentWorkflowRequest) -> Dict[str, Any]:
    """Execute the 5-stage multi-model autonomous workflow (Nano 30B + Tavily -> Super 120B -> 3x Sandbox Loop -> Ultra 550B -> Blotter Action)."""
    snap_dict = _resolve_snapshot_dict(req.snapshot)
    return agent_orchestrator.run_multi_step_workflow(
        snapshot=snap_dict,
        mission=req.mission,
        auto_commit_trade=req.auto_commit_trade,
        user_email=req.user_email,
    )


@router.post("/coding-agent")
def execute_coding_agent_iterations(req: CodingAgentRequest) -> Dict[str, Any]:
    """Run the Self-Iterating Quant Strategy Coding Agent (3 Write -> Test -> Diagnose -> Refactor cycles)."""
    snap_dict = _resolve_snapshot_dict(req.snapshot)
    return agent_orchestrator.run_coding_agent(
        prompt=req.prompt.strip(),
        snapshot=snap_dict,
    )


@router.get("/memory")
def get_agent_memory(symbol: Optional[str] = None) -> Dict[str, Any]:
    """Return persistent episodic & semantic desk memories and autonomous action ledger."""
    return agent_memory_store.get_state(active_symbol=symbol)


@router.post("/memory")
def create_agent_memory(req: AddMemoryRequest) -> Dict[str, Any]:
    """Persist a new trader preference or quantitative execution rule into episodic memory."""
    added = agent_memory_store.add_memory(
        category=req.category,
        symbol_scope=req.symbol_scope,
        rule_summary=req.rule_summary,
    )
    return {
        "added_memory": added,
        "memory_state": agent_memory_store.get_state(),
    }


@router.post("/tavily-search")
def run_tavily_financial_search(req: TavilySearchRequest) -> Dict[str, Any]:
    """Execute live Tavily financial/news search (`topic='finance'` / `'news'`) and synthesize catalyst toxicity impact via NVIDIA Nemotron-3."""
    return tavily_service.search_financial_catalysts(
        symbol=req.symbol,
        custom_query=req.query,
        topic=req.topic,
        search_depth=req.search_depth,
        max_results=req.max_results,
    )


@router.post("/tavily-extract")
def run_tavily_url_extract(req: TavilyExtractRequest) -> Dict[str, Any]:
    """Extract clean institutional text from a financial URL via Tavily `/extract`."""
    return tavily_service.extract_url_content(url=req.url)
