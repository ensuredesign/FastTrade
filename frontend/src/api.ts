import type {
  CopilotResponse,
  DashboardSnapshot,
  NebiusStatusResponse,
  NebiusTierId,
  RunOptions,
  TacticalBriefResponse,
  TCAReportResponse,
} from './types';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getDashboardSnapshot(
  signal?: AbortSignal,
  refresh = false,
  symbol?: string,
): Promise<DashboardSnapshot> {
  const params = new URLSearchParams();
  if (refresh) params.set('refresh', 'true');
  if (symbol) params.set('symbol', symbol);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBase}/api/v1/dashboard/snapshot${qs}`, { signal });
  if (!response.ok) throw new Error(`Dashboard API returned ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || (payload as { schema_version?: unknown }).schema_version !== '1.0') {
    throw new Error('Unsupported dashboard snapshot schema');
  }
  return payload as DashboardSnapshot;
}

export async function runDashboard(options: RunOptions): Promise<DashboardSnapshot> {
  const response = await fetch(`${apiBase}/api/v1/dashboard/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error(`Dashboard run failed (${response.status})`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || (payload as { schema_version?: unknown }).schema_version !== '1.0') {
    throw new Error('Unsupported dashboard snapshot schema');
  }
  return payload as DashboardSnapshot;
}

export async function getNebiusStatus(signal?: AbortSignal): Promise<NebiusStatusResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/status`, { signal });
  if (!response.ok) throw new Error(`Nebius status API returned ${response.status}`);
  return (await response.json()) as NebiusStatusResponse;
}

export async function generateTacticalBrief(
  snapshot?: DashboardSnapshot | null,
  tier: NebiusTierId = 'auto',
): Promise<TacticalBriefResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/tactical-brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, snapshot: snapshot ?? null }),
  });
  if (!response.ok) throw new Error(`Tactical brief failed (${response.status})`);
  return (await response.json()) as TacticalBriefResponse;
}

export async function generateTCAReport(
  snapshot?: DashboardSnapshot | null,
  tier: NebiusTierId = 'auto',
): Promise<TCAReportResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/tca-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, snapshot: snapshot ?? null }),
  });
  if (!response.ok) throw new Error(`TCA report generation failed (${response.status})`);
  return (await response.json()) as TCAReportResponse;
}

export async function askExecutionCopilot(
  query: string,
  snapshot?: DashboardSnapshot | null,
  tier: NebiusTierId = 'auto',
): Promise<CopilotResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, tier, snapshot: snapshot ?? null }),
  });
  if (!response.ok) throw new Error(`Copilot query failed (${response.status})`);
  return (await response.json()) as CopilotResponse;
}


import type {
  AdminOverviewResponse,
  AuthResponse,
  EmailLogEntry,
  LiveMarketSnapshot,
  PasswordResetRequestResponse,
  PortfolioAndBlotterResponse,
  PreTradeStressResponse,
  ScenarioKey,
  Side,
  SystemConfig,
  TradeBlotterEntry,
  UserAccount,
  UserPreferences,
} from './types';

export async function runPreTradeStress(options: RunOptions): Promise<PreTradeStressResponse> {
  const response = await fetch(`${apiBase}/api/v1/dashboard/pretrade-stress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) throw new Error(`Pre-trade stress test failed (${response.status})`);
  return (await response.json()) as PreTradeStressResponse;
}

export async function demoLogin(role: 'trader' | 'admin'): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error(`Demo login failed (${response.status})`);
  return (await response.json()) as AuthResponse;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Invalid credentials' }));
    throw new Error((err as { detail?: string }).detail || 'Login failed');
  }
  return (await response.json()) as AuthResponse;
}

export async function registerUser(payload: {
  email: string;
  password: string;
  full_name: string;
  organization: string;
  title: string;
  role?: 'trader' | 'admin';
}): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error((err as { detail?: string }).detail || 'Registration failed');
  }
  return (await response.json()) as AuthResponse;
}

export async function requestPasswordReset(email: string): Promise<PasswordResetRequestResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Password reset request failed' }));
    throw new Error((err as { detail?: string }).detail || 'Password reset request failed');
  }
  return (await response.json()) as PasswordResetRequestResponse;
}

export async function resetPasswordWithCode(payload: {
  email: string;
  reset_code: string;
  new_password: string;
  reset_token?: string;
}): Promise<AuthResponse> {
  const response = await fetch(`${apiBase}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Password reset failed' }));
    throw new Error((err as { detail?: string }).detail || 'Password reset failed');
  }
  return (await response.json()) as AuthResponse;
}

export async function changeUserPassword(
  token: string,
  payload: {
    current_password: string;
    new_password: string;
  },
): Promise<{
  ok: boolean;
  user: UserAccount;
  email_notification?: EmailLogEntry | null;
  message: string;
}> {
  const response = await fetch(`${apiBase}/api/v1/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Password change failed' }));
    throw new Error((err as { detail?: string }).detail || 'Password change failed');
  }
  return (await response.json()) as {
    ok: boolean;
    user: UserAccount;
    email_notification?: EmailLogEntry | null;
    message: string;
  };
}

export async function getCurrentUser(token: string): Promise<{ user: UserAccount }> {
  const response = await fetch(`${apiBase}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Session expired');
  return (await response.json()) as { user: UserAccount };
}

export async function updateUserProfile(
  token: string,
  payload: {
    full_name?: string;
    title?: string;
    organization?: string;
    preferences?: Partial<UserPreferences>;
    current_password?: string;
    new_password?: string;
    send_confirmation_email?: boolean;
  },
): Promise<{ user: UserAccount; email_dispatched?: EmailLogEntry | null; email_notification?: EmailLogEntry | null }> {
  const response = await fetch(`${apiBase}/api/v1/auth/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Profile update failed' }));
    throw new Error((err as { detail?: string }).detail || 'Profile update failed');
  }
  return (await response.json()) as {
    user: UserAccount;
    email_dispatched?: EmailLogEntry | null;
    email_notification?: EmailLogEntry | null;
  };
}

export async function getAdminOverview(token?: string | null): Promise<AdminOverviewResponse> {
  const response = await fetch(`${apiBase}/api/v1/admin/overview`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Failed to load Admin overview');
  return (await response.json()) as AdminOverviewResponse;
}

export async function adminUpdateUser(
  token: string | null,
  userId: number,
  updates: { role?: string; is_active?: boolean },
): Promise<{ user: UserAccount }> {
  const response = await fetch(`${apiBase}/api/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update user');
  return (await response.json()) as { user: UserAccount };
}

export async function adminUpdateConfig(
  token: string | null,
  updates: Partial<SystemConfig>,
): Promise<{ system_config: SystemConfig }> {
  const response = await fetch(`${apiBase}/api/v1/admin/config`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update system configuration');
  return (await response.json()) as { system_config: SystemConfig };
}

export async function sendTransactionalEmail(
  token: string | null,
  payload: {
    to_email: string;
    subject?: string;
    message?: string;
    order_id?: string;
    scenario?: string;
    shortfall_bps?: number;
    savings_usd?: number;
    report_markdown?: string;
  },
): Promise<{ email_result: EmailLogEntry; email_logs: EmailLogEntry[] }> {
  const response = await fetch(`${apiBase}/api/v1/admin/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('Email dispatch failed');
  return (await response.json()) as { email_result: EmailLogEntry; email_logs: EmailLogEntry[] };
}


export async function syncSupabaseSchema(token: string | null): Promise<{
  sync_result: {
    ok: boolean;
    status: string;
    synced_users_count?: number;
    diagnostic?: string;
    timestamp?: string;
  };
}> {
  const response = await fetch(`${apiBase}/api/v1/admin/supabase-sync`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Supabase sync request failed');
  return (await response.json()) as {
    sync_result: {
      ok: boolean;
      status: string;
      synced_users_count?: number;
      diagnostic?: string;
      timestamp?: string;
    };
  };
}

export async function getLiveMarketData(refresh = false): Promise<LiveMarketSnapshot> {
  const qs = refresh ? '?refresh=true' : '';
  const response = await fetch(`${apiBase}/api/v1/market/live${qs}`);
  if (!response.ok) throw new Error(`Live market feed returned ${response.status}`);
  return (await response.json()) as LiveMarketSnapshot;
}

export async function getPortfolioAndBlotter(
  refresh = false,
  userEmail?: string | null,
  token?: string | null,
): Promise<PortfolioAndBlotterResponse> {
  const params = new URLSearchParams();
  if (refresh) params.set('refresh', 'true');
  if (userEmail) params.set('user_email', userEmail);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBase}/api/v1/portfolio${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Portfolio API returned ${response.status}`);
  return (await response.json()) as PortfolioAndBlotterResponse;
}

export async function executePortfolioTrade(
  payload: {
    symbol: string;
    side: Side;
    quantity: number;
    scenario?: ScenarioKey;
    horizon_sec?: number;
    user_email?: string;
  },
  token?: string | null,
): Promise<{
  trade: TradeBlotterEntry;
  portfolio: PortfolioAndBlotterResponse;
  snapshot: DashboardSnapshot;
}> {
  const response = await fetch(`${apiBase}/api/v1/portfolio/trade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Trade execution failed (${response.status})`);
  return (await response.json()) as {
    trade: TradeBlotterEntry;
    portfolio: PortfolioAndBlotterResponse;
    snapshot: DashboardSnapshot;
  };
}

export async function resetPortfolio(
  userEmail?: string | null,
  token?: string | null,
): Promise<PortfolioAndBlotterResponse> {
  const params = new URLSearchParams();
  if (userEmail) params.set('user_email', userEmail);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${apiBase}/api/v1/portfolio/reset${qs}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Portfolio reset failed (${response.status})`);
  return (await response.json()) as PortfolioAndBlotterResponse;
}


export async function runAutonomousWorkflow(payload: {
  mission?: string;
  auto_commit_trade?: boolean;
  user_email?: string;
  snapshot?: DashboardSnapshot | null;
}): Promise<import('./types').AutonomousWorkflowResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/agent-workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Autonomous workflow failed (${response.status})`);
  return (await response.json()) as import('./types').AutonomousWorkflowResponse;
}

export async function runCodingAgentIterations(payload: {
  prompt: string;
  snapshot?: DashboardSnapshot | null;
}): Promise<import('./types').CodingAgentResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/coding-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Coding agent failed (${response.status})`);
  return (await response.json()) as import('./types').CodingAgentResponse;
}

export async function getAgentMemory(symbol?: string): Promise<import('./types').AgentMemoryState> {
  const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
  const response = await fetch(`${apiBase}/api/v1/ai/memory${qs}`);
  if (!response.ok) throw new Error(`Agent memory API failed (${response.status})`);
  return (await response.json()) as import('./types').AgentMemoryState;
}

export async function addAgentMemory(payload: {
  category: string;
  symbol_scope: string;
  rule_summary: string;
}): Promise<{
  added_memory: import('./types').AgentMemoryItem;
  memory_state: import('./types').AgentMemoryState;
}> {
  const response = await fetch(`${apiBase}/api/v1/ai/memory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Add agent memory failed (${response.status})`);
  return (await response.json()) as {
    added_memory: import('./types').AgentMemoryItem;
    memory_state: import('./types').AgentMemoryState;
  };
}

export async function searchTavilyFinancialCatalysts(payload: {
  symbol: string;
  query?: string;
  topic?: 'finance' | 'news' | 'general';
  search_depth?: 'ultra-fast' | 'fast' | 'basic' | 'advanced';
  max_results?: number;
}): Promise<import('./types').TavilyFinancialSearchResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/tavily-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  return (await response.json()) as import('./types').TavilyFinancialSearchResponse;
}

export async function extractTavilyUrlContent(url: string): Promise<import('./types').TavilyExtractResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/tavily-extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(`Tavily extract failed (${response.status})`);
  return (await response.json()) as import('./types').TavilyExtractResponse;
}

export async function getNebiusSandboxStatus(): Promise<import('./types').NebiusSandboxStatus> {
  const response = await fetch(`${apiBase}/api/v1/ai/sandbox-status`);
  if (!response.ok) throw new Error(`Nebius Sandbox status failed (${response.status})`);
  return (await response.json()) as import('./types').NebiusSandboxStatus;
}

export async function executeInNebiusSandbox(payload: {
  python_code: string;
  apt_packages?: string[];
  pip_packages?: string[];
  save_checkpoint?: boolean;
}): Promise<import('./types').NebiusSandboxRunResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/sandbox-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `Sandbox run failed (${response.status})` }));
    throw new Error((err as { detail?: string }).detail || `Sandbox run failed (${response.status})`);
  }
  return (await response.json()) as import('./types').NebiusSandboxRunResponse;
}

export async function shareLangSmithTrace(traceId: string): Promise<import('./types').LangSmithShareResponse> {
  const response = await fetch(`${apiBase}/api/v1/ai/langsmith-share/${encodeURIComponent(traceId)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: `LangSmith share failed (${response.status})` }));
    throw new Error((err as { detail?: string }).detail || `LangSmith share failed (${response.status})`);
  }
  return (await response.json()) as import('./types').LangSmithShareResponse;
}
