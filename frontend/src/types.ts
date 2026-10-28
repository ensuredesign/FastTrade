/** Phase 1–3 dashboard contract. Prices and costs use the instrument's quote currency. */
export type Side = 'buy' | 'sell';
export type Strategy = 'market' | 'twap' | 'vwap' | 'almgren_chriss' | 'proposed' | 'fasttrade';
export type Action = 'passive' | 'aggressive' | 'wait';
export type ScenarioKey =
  | 'normal_market'
  | 'high_volatility'
  | 'poor_liquidity'
  | 'high_adverse_selection'
  | 'low_adverse_selection'
  | 'small_order'
  | 'medium_order'
  | 'large_order'
  | 'short_execution_horizon'
  | 'long_execution_horizon';

export type NebiusTierId = 'fast' | 'balanced' | 'ultra' | 'auto';

export interface BookLevel {
  price: number;
  quantity: number;
}

export interface MarketState {
  timestamp: string; // UTC ISO 8601
  symbol: string;
  bids: BookLevel[]; // best bid first
  asks: BookLevel[]; // best ask first
  mid_price: number;
  spread: number;
  order_flow_imbalance: number; // legacy API name; currently L1 depth imbalance [-1, 1]
}

export interface FeaturePoint {
  timestamp: string; // UTC ISO 8601
  spread_bps: number | null;
  depth_imbalance_l1: number | null; // [-1, 1]
  ofi_instant: number | null; // signed quantity
  volatility_std_10: number | null; // log-return standard deviation
  momentum_ret_5: number | null; // five-tick simple return
  total_bid_depth: number;
  total_ask_depth: number;
}

export interface FeatureState {
  points: FeaturePoint[]; // oldest first
}

export interface ExecutionPoint {
  timestamp: string;
  remaining_quantity: number;
  filled_quantity: number; // cumulative
  reference_price: number;
  execution_price: number | null;
  action: Action;
}

export interface ExecutionState {
  order_id: string;
  symbol: string;
  side: Side;
  target_quantity: number;
  filled_quantity: number;
  remaining_quantity: number;
  selected_action: Action;
  execution_score: number; // [0, 1], higher means more urgency
  trajectory: ExecutionPoint[];
}

export interface RiskState {
  timestamp: string;
  adverse_selection_probability: number; // [0, 1], post-fill adverse move
  fill_probability: number | null; // unavailable until fill estimator is exposed
  prediction_horizon_ms: number | null;
  expected_market_impact_bps: number | null;
  expected_shortfall_bps: number | null;
  model_status: string;
  model_name: string;
  prediction_horizon: number;
  prediction_horizon_unit: 'ticks';
  history: RiskPoint[]; // oldest first
}

export interface RiskPoint {
  timestamp: string;
  adverse_selection_probability: number;
  model_status: string;
}

export interface ACSchedulePoint {
  elapsed_sec: number;
  planned_remaining_quantity: number;
  planned_slice_quantity: number;
}

export interface ACScheduleState {
  total_quantity: number;
  horizon_sec: number;
  num_slices: number;
  expected_cost: number; // quote currency, currently USD
  cost_variance: number; // squared units; do not label as USD
  utility_cost: number;
  cost_unit: 'USD';
  points: ACSchedulePoint[]; // last point closes schedule; slice quantity is zero
}

export interface ForecastPoint {
  timestamp: string;
  expected_move_bps: number | null;
  direction: string | null;
  model_status: string;
  valid: boolean;
  action: Action;
  decision_reason: string;
}

export interface ForecastState {
  source: 'local' | 'nebius';
  model_name: string;
  horizon: number;
  horizon_unit: 'observations';
  points: ForecastPoint[];
}

export interface VenueQuoteState {
  venue_id: string;
  venue_name: string;
  best_bid: number;
  best_ask: number;
  bid_depth: number;
  ask_depth: number;
  spread: number;
  spread_bps: number;
  liquidity_score: number;
  execution_risk: number;
  est_cost_bps: number;
  routed_quantity: number;
  allocation_pct: number;
}

export interface VenueRoutingState {
  timestamp: string;
  total_quantity: number;
  side: Side;
  venues: VenueQuoteState[];
  explanation: string;
  avg_price: number;
  effective_spread_bps: number;
  total_cost_est: number;
}

export interface RegimeInfoState {
  regime: string;
  badge_label: string;
  color: string;
  explanation: string;
  volatility_pct: number;
  spread_bps: number;
  depth_score: number;
}

export interface ExecutionParametersState {
  risk_aversion: number;
  risk_high_threshold: number;
  risk_low_threshold: number;
  urgency_high_threshold: number;
  ac_num_slices: number;
}

export interface RunOptions {
  scenario: ScenarioKey;
  side: Side;
  order_size: number;
  horizon_sec: number;
  symbol?: string;
  record_trade?: boolean;
  user_email?: string;
  risk_aversion?: number;
  risk_high_threshold?: number;
  risk_low_threshold?: number;
  urgency_high_threshold?: number;
  ac_num_slices?: number;
}

export interface StrategyResult {
  strategy: Strategy;
  filled_quantity: number;
  fill_rate: number; // [0, 1]
  slippage_bps: number;
  market_impact_bps: number;
  implementation_shortfall_bps: number;
  adverse_selection_bps: number;
}

export interface PerformanceState {
  run_id: string;
  completed_at: string;
  results: StrategyResult[];
}

export interface DashboardSnapshot {
  schema_version: '1.0';
  market: MarketState | null;
  features?: FeatureState | null;
  execution: ExecutionState | null;
  risk: RiskState | null;
  ac_schedule?: ACScheduleState | null;
  forecast?: ForecastState | null;
  scenario?: string | null;
  performance: PerformanceState | null;
  venue_routing?: VenueRoutingState | null;
  regime_info?: RegimeInfoState | null;
  active_parameters?: ExecutionParametersState | null;
}

export interface NebiusModelTierInfo {
  tier_id: 'fast' | 'balanced' | 'ultra';
  model_id: string;
  display_name: string;
  architecture: string;
  use_case: string;
  target_latency_ms: number;
}

export interface NebiusSandboxStatus {
  configured: boolean;
  sdk_installed: boolean;
  sdk_package: string;
  status: string;
  endpoint: string;
  project_id: string | null;
  service_account_id: string | null;
  base_image: string;
  prepared_harness_uuid: string | null;
  permissions: {
    import?: boolean;
    spawn?: boolean;
    spawn_disposable?: boolean;
  };
  limits: {
    instance_max_concurrency?: number;
    instance_max_timeout?: number;
  };
  telemetry: {
    total_sandbox_operations: number;
    last_checkpoint_uuid: string | null;
    last_latency_ms: number | null;
  };
}

export interface LangSmithStatus {
  configured: boolean;
  sdk_installed: boolean;
  sdk_package: string;
  status: string;
  project_name: string;
  endpoint: string;
  telemetry: {
    total_root_traces: number;
    total_child_spans: number;
    last_trace_id: string | null;
    last_trace_name: string | null;
    last_public_url: string | null;
  };
  recent_traces: Array<{
    trace_id: string;
    name: string;
    run_type: string;
    project_name: string;
    latency_ms: number;
    public_url?: string | null;
    created_at: string;
  }>;
}

export interface LangSmithShareResponse {
  trace_id: string;
  public_url: string;
  project_name: string;
  cached: boolean;
}

export interface NebiusSandboxRunResponse {
  status: string;
  provider: string;
  project_id: string;
  service_account_id?: string | null;
  base_image: string;
  checkpoint_uuid?: string | null;
  exit_code: number;
  stdout: string;
  stderr: string;
  setup_steps: Array<{ step: string; checkpoint_uuid: string }>;
  latency_ms: number;
  langsmith_trace_id?: string | null;
  executed_at: string;
}

export interface NebiusStatusResponse {
  configured: boolean;
  provider: string;
  base_url: string;
  tavily_configured?: boolean;
  nebius_sandboxes?: NebiusSandboxStatus;
  langsmith?: LangSmithStatus;
  nvidia_model_tiers: NebiusModelTierInfo[];
  telemetry: {
    total_requests: number;
    successful_requests: number;
    fallback_requests: number;
    avg_latency_ms: number | null;
    last_model_used: string | null;
    last_tier_used: string | null;
    last_latency_ms: number | null;
    tier_counts: Record<string, number>;
  };
}

export interface TacticalBriefResponse {
  status: string;
  provider: string;
  tier: string;
  model_id: string;
  model_display_name: string;
  routing_reason: string;
  latency_ms: number;
  headline: string;
  regime_assessment: string;
  routing_rationale: string;
  alpha_highlight: string;
  risk_guardrail: string;
  reasoning_trace?: string | null;
  langsmith_trace_id?: string | null;
  generated_at: string;
}

export interface TCAReportResponse {
  status: string;
  provider: string;
  tier: string;
  model_id: string;
  model_display_name: string;
  routing_reason: string;
  latency_ms: number;
  order_id: string;
  scenario: string;
  notional_usd: number;
  fasttrade_shortfall_bps: number;
  savings_vs_twap_bps: number;
  savings_vs_twap_usd: number;
  savings_vs_market_bps: number;
  savings_vs_market_usd: number;
  report_markdown: string;
  reasoning_trace?: string | null;
  langsmith_trace_id?: string | null;
  generated_at: string;
}

export interface CopilotResponse {
  status: string;
  provider: string;
  tier: string;
  model_id: string;
  model_display_name: string;
  routing_reason: string;
  latency_ms: number;
  query: string;
  answer: string;
  reasoning_trace?: string | null;
  langsmith_trace_id?: string | null;
  suggested_followups: string[];
  generated_at: string;
}


export interface UserPreferences {
  default_scenario: ScenarioKey;
  default_side: Side;
  default_order_size: number;
  default_horizon_sec: number;
  risk_aversion: number;
  risk_high_threshold: number;
  urgency_high_threshold: number;
  ac_num_slices: number;
  preferred_ai_tier: NebiusTierId;
  email_notifications: boolean;
}

export interface UserAccount {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'trader' | 'analyst';
  title: string;
  organization: string;
  preferences: UserPreferences;
  is_active: boolean;
  simulations_count: number;
  created_at: string;
  last_login_at: string | null;
}

export interface EmailLogEntry {
  id: string;
  to: string;
  from: string;
  subject: string;
  category: string;
  status: string;
  latency_ms: number;
  created_at: string;
  error?: string | null;
}

export interface AuditLogEntry {
  id: number;
  actor_email: string;
  action: string;
  details: string;
  created_at: string;
}

export interface SystemConfig {
  max_parent_order_size: number;
  global_toxicity_ceiling: number;
  default_ai_routing_policy: NebiusTierId;
  auto_email_tca_reports: boolean;
  maintenance_mode: boolean;
  updated_at: string;
  updated_by: string;
}

export interface AuthResponse {
  token: string;
  user: UserAccount;
  email_dispatched?: EmailLogEntry | null;
  email_notification?: EmailLogEntry | null;
}

export interface PasswordResetRequestResponse {
  ok: boolean;
  message: string;
  email: string;
  reset_token: string;
  expires_in_minutes: number;
  email_notification?: EmailLogEntry | null;
}

export interface AdminOverviewResponse {
  actor: string;
  users: UserAccount[];
  system_config: SystemConfig;
  audit_logs: AuditLogEntry[];
  email_logs: EmailLogEntry[];
  resend_status: {
    configured: boolean;
    from_email: string;
  };
  database_status?: {
    project_url: string;
    db_user: string;
    anon_key_configured: boolean;
    local_replica_path: string;
    migration_file: string;
    last_sync?: {
      ok: boolean;
      status: string;
      synced_users_count?: number;
      diagnostic?: string;
      timestamp?: string;
    } | null;
  };
  nebius_status: NebiusStatusResponse;
}

export interface PreTradePercentilePoint {
  percentile: string;
  shortfall_bps: number;
  cost_usd: number;
}

export interface OptimalParametersRecommendation {
  risk_aversion: number;
  risk_high_threshold: number;
  urgency_high_threshold: number;
  ac_num_slices: number;
  estimated_shortfall_bps: number;
  expected_improvement_bps: number;
  expected_improvement_usd: number;
  rationale: string;
}

export interface PreTradeStressResponse {
  scenario: string;
  side: Side;
  order_size: number;
  horizon_sec: number;
  notional_usd: number;
  monte_carlo_paths: number;
  expected_shortfall_bps: number;
  expected_shortfall_usd: number;
  car_95_bps: number;
  car_95_usd: number;
  car_99_bps: number;
  car_99_usd: number;
  twap_expected_bps: number;
  win_prob_vs_twap_pct: number;
  permanent_impact_bps: number;
  temporary_impact_bps: number;
  adverse_selection_drift_bps: number;
  cro_guardrail_status: 'PASS' | 'WARNING' | 'CAPPED';
  cro_guardrail_message: string;
  max_parent_order_limit: number;
  global_toxicity_ceiling: number;
  percentile_curve: PreTradePercentilePoint[];
  optimal_parameters: OptimalParametersRecommendation;
}

export interface LiveIntradayPoint {
  timestamp: number;
  time_label: string;
  price: number;
  high: number;
  low: number;
  volume: number;
  vwap: number;
}

export interface LiveIndexQuote {
  symbol: string;
  yahoo_symbol: string;
  name: string;
  asset_class: string;
  price: number;
  prev_close: number;
  change_abs: number;
  change_pct: number;
  realized_vol_pct: number;
  is_live: boolean;
  ems_target: string;
}

export interface LiveInstrumentQuote {
  symbol: string;
  yahoo_symbol: string;
  name: string;
  asset_class: string;
  primary_venue: string;
  price: number;
  prev_close: number;
  change_abs: number;
  change_pct: number;
  day_high: number;
  day_low: number;
  day_volume: number;
  spread_bps: number;
  realized_vol_pct: number;
  l5_depth_usd: number;
  ofi_score: number;
  toxicity_prob: number;
  is_live: boolean;
  l2_source: string;
  intraday_series: LiveIntradayPoint[];
  recommended_preset: {
    scenario: ScenarioKey;
    side: Side;
    order_size: number;
    horizon_sec: number;
    risk_aversion: number;
  };
}

export interface LiveMarketSnapshot {
  provider: string;
  is_live: boolean;
  live_symbols_count: number;
  updated_at: string;
  indices: LiveIndexQuote[];
  instruments: LiveInstrumentQuote[];
}

export interface PortfolioSummary {
  account_owner_email?: string;
  starting_capital_usd: number;
  total_nav_usd: number;
  cash_balance_usd: number;
  gross_exposure_usd: number;
  net_exposure_usd: number;
  total_unrealized_pnl_usd: number;
  total_realized_pnl_usd: number;
  total_pnl_usd: number;
  total_return_pct: number;
  cumulative_alpha_saved_usd: number;
  avg_shortfall_bps: number;
  total_trades_count: number;
  total_traded_volume_usd: number;
  open_positions_count: number;
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  asset_class: string;
  primary_venue: string;
  side: 'LONG' | 'SHORT' | 'FLAT';
  net_quantity: number;
  avg_entry_price: number;
  live_price: number;
  day_change_pct: number;
  cost_basis_usd: number;
  market_value_usd: number;
  unrealized_pnl_usd: number;
  unrealized_pnl_pct: number;
  realized_pnl_usd: number;
  total_pnl_usd: number;
  alpha_saved_usd: number;
  trades_count: number;
  weight_pct: number;
  last_traded_at: string;
}

export interface TradeBlotterEntry {
  trade_id: string;
  order_id: string;
  user_email: string;
  symbol: string;
  asset_class: string;
  side: Side;
  quantity: number;
  arrival_price: number;
  avg_fill_price: number;
  notional_usd: number;
  shortfall_bps: number;
  twap_shortfall_bps: number;
  alpha_saved_usd: number;
  venue_summary: string;
  scenario: string;
  strategy: string;
  status: string;
  executed_at: string;
}

export interface PortfolioAndBlotterResponse {
  account_owner_email?: string;
  updated_at: string;
  market_data_provider: string;
  is_live_market: boolean;
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
  trades: TradeBlotterEntry[];
}


export interface AgentMemoryItem {
  memory_id: string;
  category: string;
  symbol_scope: string;
  rule_summary: string;
  learned_parameters: Record<string, number | boolean | string>;
  source: string;
  confidence: number;
  created_at: string;
}

export interface AgentActionRecord {
  action_id: string;
  action_type: string;
  symbol: string;
  summary: string;
  details: Record<string, unknown>;
  model_used: string;
  executed_at: string;
}

export interface AgentMemoryState {
  total_memories: number;
  total_autonomous_actions: number;
  memories: AgentMemoryItem[];
  relevant_memories: AgentMemoryItem[];
  recent_actions: AgentActionRecord[];
}

export interface WorkflowSandboxIteration {
  iteration: number;
  label: string;
  params: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  };
  shortfall_bps: number;
  tail_car_99_bps: number;
  fill_rate_pct: number;
  assertions_passed: string;
  diagnostic: string;
}

export interface WorkflowStageStep {
  step_number: number;
  stage_id: string;
  title: string;
  model_tier: 'fast' | 'balanced' | 'ultra';
  model_id: string;
  tool_called: string;
  status: string;
  latency_ms: number;
  summary: string;
  artifacts: Record<string, unknown>;
}

export interface AutonomousWorkflowResponse {
  workflow_id: string;
  provider: string;
  models_orchestrated: string[];
  mission: string;
  symbol: string;
  side: string;
  quantity: number;
  notional_usd: number;
  total_latency_ms: number;
  steps: WorkflowStageStep[];
  sandbox_iterations: WorkflowSandboxIteration[];
  recommended_params: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  };
  committed_trade?: TradeBlotterEntry | null;
  memory_state: AgentMemoryState;
  langsmith_trace_id?: string | null;
  generated_at: string;
}

export interface CodingUnitTestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  detail: string;
}

export interface CodingAgentIteration {
  iteration: number;
  version_tag: string;
  title: string;
  code: string;
  ast_valid: boolean;
  passed_count: number;
  total_tests: number;
  shortfall_bps: number;
  alpha_vs_twap_bps: number;
  tail_car_99_bps: number;
  unit_tests: CodingUnitTestResult[];
  compiler_diagnosis: string;
  sandbox_exit_code?: number;
  sandbox_image_uuid?: string | null;
}

export interface CodingAgentResponse {
  session_id: string;
  provider: string;
  model_id: string;
  model_display_name: string;
  symbol: string;
  scenario: string;
  prompt: string;
  architectural_summary: string;
  reasoning_trace?: string | null;
  latency_ms: number;
  iterations: CodingAgentIteration[];
  final_code: string;
  tuned_parameters: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  };
  nebius_sandbox?: {
    executed_live: boolean;
    provider: string;
    project_id?: string | null;
    service_account_id?: string | null;
    base_image: string;
    base_checkpoint_uuid?: string | null;
    promoted_image_uuid?: string | null;
    parallel_branches?: number;
    latency_ms?: number;
  };
  langsmith_trace_id?: string | null;
  generated_at: string;
}

export interface TavilyCitationItem {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  score: number;
  published_date?: string | null;
}

export interface TavilyFinancialSearchResponse {
  status: string;
  provider: string;
  configured: boolean;
  symbol: string;
  query: string;
  topic: 'finance' | 'news' | 'general';
  search_depth: string;
  latency_ms: number;
  nemotron_latency_ms: number;
  catalyst_regime: string;
  event_risk_score: number;
  tavily_answer?: string | null;
  nemotron_synthesis: string;
  citations: TavilyCitationItem[];
  recommended_params: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  };
  langsmith_trace_id?: string | null;
  generated_at: string;
}

export interface TavilyExtractResponse {
  status: string;
  url: string;
  latency_ms: number;
  extracted_content: string;
  generated_at: string;
}
