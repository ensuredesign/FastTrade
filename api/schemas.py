"""
Pydantic API Schemas conforming strictly to frontend/src/types.ts (Phase 1–3 contract).
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field

# Domain Literal types
Side = Literal["buy", "sell"]
Strategy = Literal["market", "twap", "vwap", "almgren_chriss", "proposed", "fasttrade"]
Action = Literal["passive", "aggressive", "wait"]


class BookLevel(BaseModel):
    price: float
    quantity: float


class MarketState(BaseModel):
    timestamp: str  # UTC ISO 8601
    symbol: str
    bids: List[BookLevel]
    asks: List[BookLevel]
    mid_price: float
    spread: float
    order_flow_imbalance: float


class FeaturePoint(BaseModel):
    """One chronological market-feature observation for Phase 3 charts."""

    timestamp: str  # UTC ISO 8601
    spread_bps: Optional[float] = None
    depth_imbalance_l1: Optional[float] = None  # [-1, 1]
    ofi_instant: Optional[float] = None  # signed quantity, not a normalized ratio
    volatility_std_10: Optional[float] = None  # standard deviation of log returns
    momentum_ret_5: Optional[float] = None  # five-tick simple return
    total_bid_depth: float
    total_ask_depth: float


class FeatureState(BaseModel):
    points: List[FeaturePoint]


class ExecutionPoint(BaseModel):
    timestamp: str
    remaining_quantity: float
    filled_quantity: float
    reference_price: float
    execution_price: Optional[float] = None
    action: Action


class ExecutionState(BaseModel):
    order_id: str
    symbol: str
    side: Side
    target_quantity: float
    filled_quantity: float
    remaining_quantity: float
    selected_action: Action
    execution_score: float
    trajectory: List[ExecutionPoint]


class RiskPoint(BaseModel):
    timestamp: str  # UTC ISO 8601
    adverse_selection_probability: float
    model_status: str


class RiskState(BaseModel):
    timestamp: str
    adverse_selection_probability: float
    fill_probability: Optional[float] = None
    prediction_horizon_ms: Optional[int] = None
    expected_market_impact_bps: Optional[float] = None
    expected_shortfall_bps: Optional[float] = None
    model_status: str = ""
    model_name: str = ""
    prediction_horizon: int = 10
    prediction_horizon_unit: Literal["ticks"] = "ticks"
    history: List[RiskPoint] = []


class ACSchedulePoint(BaseModel):
    elapsed_sec: float
    planned_remaining_quantity: float
    planned_slice_quantity: float


class ACScheduleState(BaseModel):
    total_quantity: float
    horizon_sec: float
    num_slices: int
    expected_cost: float
    cost_variance: float
    utility_cost: float
    cost_unit: Literal["USD"] = "USD"
    points: List[ACSchedulePoint]


class ForecastPoint(BaseModel):
    timestamp: str
    expected_move_bps: Optional[float] = None
    direction: Optional[str] = None
    model_status: str
    valid: bool
    action: Action
    decision_reason: str


class ForecastState(BaseModel):
    source: Literal["local", "nebius"]
    model_name: str
    horizon: int
    horizon_unit: Literal["observations"] = "observations"
    points: List[ForecastPoint]


class StrategyResult(BaseModel):
    strategy: Strategy
    filled_quantity: float
    fill_rate: float
    slippage_bps: float
    market_impact_bps: float
    implementation_shortfall_bps: float
    adverse_selection_bps: float


class PerformanceState(BaseModel):
    run_id: str
    completed_at: str
    results: List[StrategyResult]


class VenueQuoteState(BaseModel):
    venue_id: str
    venue_name: str
    best_bid: float
    best_ask: float
    bid_depth: float
    ask_depth: float
    spread: float
    spread_bps: float
    liquidity_score: float
    execution_risk: float
    est_cost_bps: float
    routed_quantity: float
    allocation_pct: float


class VenueRoutingState(BaseModel):
    timestamp: str
    total_quantity: float
    side: Side
    venues: List[VenueQuoteState]
    explanation: str
    avg_price: float
    effective_spread_bps: float
    total_cost_est: float


class RegimeInfoState(BaseModel):
    regime: str
    badge_label: str
    color: str
    explanation: str
    volatility_pct: float
    spread_bps: float
    depth_score: float


class ExecutionParametersState(BaseModel):
    risk_aversion: float
    risk_high_threshold: float
    risk_low_threshold: float
    urgency_high_threshold: float
    ac_num_slices: int


class DashboardSnapshot(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    market: Optional[MarketState] = None
    features: Optional[FeatureState] = None
    execution: Optional[ExecutionState] = None
    risk: Optional[RiskState] = None
    ac_schedule: Optional[ACScheduleState] = None
    forecast: Optional[ForecastState] = None
    scenario: Optional[str] = None
    performance: Optional[PerformanceState] = None
    venue_routing: Optional[VenueRoutingState] = None
    regime_info: Optional[RegimeInfoState] = None
    active_parameters: Optional[ExecutionParametersState] = None


class HealthResponse(BaseModel):
    status: str = "ok"


class PreTradePercentilePoint(BaseModel):
    percentile: str
    shortfall_bps: float
    cost_usd: float


class OptimalParametersRecommendation(BaseModel):
    risk_aversion: float
    risk_high_threshold: float
    urgency_high_threshold: float
    ac_num_slices: int
    estimated_shortfall_bps: float
    expected_improvement_bps: float
    expected_improvement_usd: float
    rationale: str


class PreTradeStressResponse(BaseModel):
    scenario: str
    side: Side
    order_size: float
    horizon_sec: float
    notional_usd: float
    monte_carlo_paths: int
    expected_shortfall_bps: float
    expected_shortfall_usd: float
    car_95_bps: float
    car_95_usd: float
    car_99_bps: float
    car_99_usd: float
    twap_expected_bps: float
    win_prob_vs_twap_pct: float
    permanent_impact_bps: float
    temporary_impact_bps: float
    adverse_selection_drift_bps: float
    cro_guardrail_status: Literal["PASS", "WARNING", "CAPPED"]
    cro_guardrail_message: str
    max_parent_order_limit: float
    global_toxicity_ceiling: float
    percentile_curve: List[PreTradePercentilePoint]
    optimal_parameters: OptimalParametersRecommendation

