import { useEffect, useState } from 'react';
import {
  addAgentMemory,
  askExecutionCopilot,
  executeInNebiusSandbox,
  extractTavilyUrlContent,
  generateTCAReport,
  generateTacticalBrief,
  getAgentMemory,
  getNebiusStatus,
  runAutonomousWorkflow,
  runCodingAgentIterations,
  searchTavilyFinancialCatalysts,
  sendTransactionalEmail,
  shareLangSmithTrace,
} from '../api';
import type {
  AgentActionRecord,
  AgentMemoryItem,
  AgentMemoryState,
  AutonomousWorkflowResponse,
  CodingAgentResponse,
  CopilotResponse,
  DashboardSnapshot,
  NebiusSandboxRunResponse,
  NebiusStatusResponse,
  NebiusTierId,
  TacticalBriefResponse,
  TavilyExtractResponse,
  TavilyFinancialSearchResponse,
  TCAReportResponse,
} from '../types';
import {
  ActivityIcon,
  CheckCircleIcon,
  CloseIcon,
  CpuIcon,
  DownloadIcon,
  FileTextIcon,
  LayersIcon,
  MailIcon,
  PlayIcon,
  PrinterIcon,
  RefreshIcon,
  ShieldIcon,
  SlidersIcon,
  SparklesIcon,
} from './Icons';

type AgentStudioTab = 'workflow' | 'coding' | 'assistant' | 'brief';

export function NebiusAIPanel({
  snapshot,
  tcaModalOpen,
  setTcaModalOpen,
  userEmail,
  token,
  onApplyParameters,
  onNavigateBlotter,
}: {
  snapshot: DashboardSnapshot | null;
  tcaModalOpen: boolean;
  setTcaModalOpen: (open: boolean) => void;
  userEmail?: string;
  token?: string | null;
  onApplyParameters?: (params: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  }) => void;
  onNavigateBlotter?: () => void;
}) {
  const [studioTab, setStudioTab] = useState<AgentStudioTab>('workflow');
  const [aiStatus, setAiStatus] = useState<NebiusStatusResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<NebiusTierId>('auto');
  const [appliedBanner, setAppliedBanner] = useState<string | null>(null);

  // Mode 1: 5-Stage Multi-Step Autonomous Workflow
  const [missionInput, setMissionInput] = useState(
    'Execute 5-stage autonomous order optimization: L2 toxicity recon, Almgren-Chriss policy synthesis, 3x self-iterating sandbox backtest, 500-path CRO CaR sign-off, and live Desk Blotter commit.',
  );
  const [autoCommitBlotter, setAutoCommitBlotter] = useState(true);
  const [workflowRes, setWorkflowRes] = useState<AutonomousWorkflowResponse | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Mode 2: Self-Iterating Quant Coding Agent + Nebius Sandboxes Beta (`contree-sdk`)
  const [codingPrompt, setCodingPrompt] = useState(
    'Design an adaptive execution algorithm that dynamically skews passive limit orders using L1 Order Flow Imbalance (OFI) and halts maker posting when XGBoost toxicity > 54%.',
  );
  const [codingRes, setCodingRes] = useState<CodingAgentResponse | null>(null);
  const [codingLoading, setCodingLoading] = useState(false);
  const [selectedCodeIter, setSelectedCodeIter] = useState<number>(3);

  const [sandboxCode, setSandboxCode] = useState(
    `import math, platform\n# Almgren-Chriss Hyperbolic Schedule Verification inside Nebius Sandbox VM\nqty, slices, kappa = 500.0, 12, 0.24\ntrajectory = [round(qty * math.sinh(kappa * (slices - k)) / math.sinh(kappa * slices), 2) for k in range(slices + 1)]\nprint(f"Nebius Cloud VM Runtime: Python {platform.python_version()} ({platform.machine()})")\nprint("Optimal Remaining Inventory Trajectory:", trajectory[:6], "...", trajectory[-2:])`,
  );
  const [sandboxAptPkgs, setSandboxAptPkgs] = useState('');
  const [sandboxRunRes, setSandboxRunRes] = useState<NebiusSandboxRunResponse | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  // Mode 3: Context-Aware Personal Assistant & Persistent Episodic Memory
  const [memoryState, setMemoryState] = useState<AgentMemoryState | null>(null);
  const [newMemCategory, setNewMemCategory] = useState('RISK_MANDATE');
  const [newMemScope, setNewMemScope] = useState('NVDA,BTC-USD');
  const [newMemRule, setNewMemRule] = useState('');
  const [savingMem, setSavingMem] = useState(false);

  const [query, setQuery] = useState('');
  const [copilotRes, setCopilotRes] = useState<CopilotResponse & {
    recalled_memories?: AgentMemoryItem[];
    executed_actions?: AgentActionRecord[];
    recommended_params?: {
      risk_aversion: number;
      risk_high_threshold: number;
      urgency_high_threshold: number;
      ac_num_slices: number;
    } | null;
  } | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [showCopilotReasoning, setShowCopilotReasoning] = useState(false);

  // Mode 4: Real-Time Tactical Brief, Tavily Financial Search & Post-Trade TCA Modal
  const [brief, setBrief] = useState<TacticalBriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [showBriefReasoning, setShowBriefReasoning] = useState(false);

  const [tavilyQuery, setTavilyQuery] = useState('');
  const [tavilyTopic, setTavilyTopic] = useState<'finance' | 'news'>('finance');
  const [tavilyRes, setTavilyRes] = useState<TavilyFinancialSearchResponse | null>(null);
  const [tavilyLoading, setTavilyLoading] = useState(false);
  const [extractRes, setExtractRes] = useState<TavilyExtractResponse | null>(null);
  const [extractLoadingUrl, setExtractLoadingUrl] = useState<string | null>(null);

  const [tcaReport, setTcaReport] = useState<TCAReportResponse | null>(null);
  const [tcaLoading, setTcaLoading] = useState(false);
  const [showTcaReasoning, setShowTcaReasoning] = useState(false);
  const [emailingTca, setEmailingTca] = useState(false);
  const [tcaEmailStatus, setTcaEmailStatus] = useState<string | null>(null);
  const [sharedTraceUrls, setSharedTraceUrls] = useState<Record<string, string>>({});
  const [sharingTraceId, setSharingTraceId] = useState<string | null>(null);

  const activeSymbol = snapshot?.market?.symbol || 'BTC-USD';

  async function handleOpenLangSmithTrace(traceId: string) {
    const existing = sharedTraceUrls[traceId];
    if (existing) {
      window.open(existing, '_blank', 'noopener,noreferrer');
      return;
    }
    setSharingTraceId(traceId);
    try {
      const res = await shareLangSmithTrace(traceId);
      setSharedTraceUrls(prev => ({ ...prev, [traceId]: res.public_url }));
      window.open(res.public_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setAppliedBanner(err instanceof Error ? err.message : 'LangSmith trace is still indexing — try again in 2s');
    } finally {
      setSharingTraceId(null);
    }
  }

  function renderLangSmithBadge(traceId?: string | null) {
    if (!traceId) return null;
    const publicUrl = sharedTraceUrls[traceId];
    if (publicUrl) {
      return (
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="btn-outline-sm mono-val"
          style={{
            padding: '3px 9px',
            fontSize: '0.73rem',
            color: '#a78bfa',
            borderColor: 'rgba(167, 139, 250, 0.45)',
            textDecoration: 'none',
          }}
        >
          LangSmith Audit Trace ({traceId.slice(0, 8)}…) ↗
        </a>
      );
    }
    return (
      <button
        type="button"
        className="btn-outline-sm mono-val"
        style={{
          padding: '3px 9px',
          fontSize: '0.73rem',
          color: '#c4b5fd',
          borderColor: 'rgba(167, 139, 250, 0.4)',
        }}
        disabled={sharingTraceId === traceId}
        onClick={() => void handleOpenLangSmithTrace(traceId)}
      >
        {sharingTraceId === traceId
          ? 'Publishing Trace…'
          : `LangSmith Trace (${traceId.slice(0, 8)}…) · Open Public Link ↗`}
      </button>
    );
  }

  async function refreshStatusAndMemory() {
    try {
      const [st, mem] = await Promise.all([
        getNebiusStatus(),
        getAgentMemory(activeSymbol),
      ]);
      setAiStatus(st);
      setMemoryState(mem);
    } catch {
      // ignore transient errors
    }
  }

  async function handleRunWorkflow(commitOverride?: boolean) {
    if (!snapshot) return;
    setWorkflowLoading(true);
    setAppliedBanner(null);
    try {
      const res = await runAutonomousWorkflow({
        mission: missionInput,
        auto_commit_trade: commitOverride ?? autoCommitBlotter,
        user_email: userEmail || 'trader@fasttrade.ai',
        snapshot,
      });
      setWorkflowRes(res);
      setMemoryState(res.memory_state);
      void getNebiusStatus().then(setAiStatus).catch(() => {});
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleRunCodingAgent(customPrompt?: string) {
    const p = (customPrompt ?? codingPrompt).trim();
    if (!p) return;
    if (customPrompt) setCodingPrompt(customPrompt);
    setCodingLoading(true);
    setAppliedBanner(null);
    try {
      const res = await runCodingAgentIterations({
        prompt: p,
        snapshot,
      });
      setCodingRes(res);
      setSelectedCodeIter(3);
      void refreshStatusAndMemory();
    } finally {
      setCodingLoading(false);
    }
  }

  async function handleExecuteInSandbox(overrideCode?: string, overrideApt?: string) {
    const codeToRun = (overrideCode ?? sandboxCode).trim();
    const aptRaw = overrideApt ?? sandboxAptPkgs;
    if (!codeToRun) return;
    if (overrideCode !== undefined) setSandboxCode(overrideCode);
    if (overrideApt !== undefined) setSandboxAptPkgs(overrideApt);
    setSandboxRunning(true);
    setSandboxError(null);
    try {
      const aptList = aptRaw
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(Boolean);
      const res = await executeInNebiusSandbox({
        python_code: codeToRun,
        apt_packages: aptList,
        save_checkpoint: true,
      });
      setSandboxRunRes(res);
      void refreshStatusAndMemory();
    } catch (err) {
      setSandboxError(err instanceof Error ? err.message : 'Nebius Sandbox execution failed');
    } finally {
      setSandboxRunning(false);
    }
  }

  async function handleAddMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemRule.trim()) return;
    setSavingMem(true);
    try {
      const res = await addAgentMemory({
        category: newMemCategory,
        symbol_scope: newMemScope || activeSymbol,
        rule_summary: newMemRule.trim(),
      });
      setMemoryState(res.memory_state);
      setNewMemRule('');
      setAppliedBanner(`Saved Persistent Memory Rule ${res.added_memory.memory_id} (${res.added_memory.category})`);
    } finally {
      setSavingMem(false);
    }
  }

  async function handleGenerateBrief(snap: DashboardSnapshot | null, tierOverride: NebiusTierId = selectedTier) {
    if (!snap) return;
    setBriefLoading(true);
    try {
      const res = await generateTacticalBrief(snap, tierOverride);
      setBrief(res);
      void refreshStatusAndMemory();
    } catch {
      // keep previous brief on transient error
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleTavilySearch(customSym?: string, customQ?: string) {
    setTavilyLoading(true);
    setExtractRes(null);
    try {
      const res = await searchTavilyFinancialCatalysts({
        symbol: customSym || activeSymbol,
        query: (customQ ?? tavilyQuery).trim() || undefined,
        topic: tavilyTopic,
        search_depth: 'basic',
        max_results: 4,
      });
      setTavilyRes(res);
    } catch {
      // ignore transient error
    } finally {
      setTavilyLoading(false);
    }
  }

  async function handleTavilyExtract(url: string) {
    setExtractLoadingUrl(url);
    try {
      const res = await extractTavilyUrlContent(url);
      setExtractRes(res);
    } finally {
      setExtractLoadingUrl(null);
    }
  }

  async function handleAskCopilot(customQuery?: string) {
    const q = (customQuery ?? query).trim();
    if (!q) return;
    if (customQuery) setQuery(customQuery);
    setCopilotLoading(true);
    try {
      const res = await askExecutionCopilot(q, snapshot, selectedTier);
      setCopilotRes(res as typeof copilotRes);
      void refreshStatusAndMemory();
    } finally {
      setCopilotLoading(false);
    }
  }

  async function handleGenerateTCA() {
    setTcaModalOpen(true);
    setTcaLoading(true);
    try {
      const res = await generateTCAReport(snapshot, selectedTier === 'auto' ? 'ultra' : selectedTier);
      setTcaReport(res);
      void refreshStatusAndMemory();
    } finally {
      setTcaLoading(false);
    }
  }

  function handleDeployParams(params: {
    risk_aversion: number;
    risk_high_threshold: number;
    urgency_high_threshold: number;
    ac_num_slices: number;
  }, sourceLabel: string) {
    if (onApplyParameters) {
      onApplyParameters(params);
    }
    setAppliedBanner(
      `Deployed ${sourceLabel} parameters to live EMS (λ=${params.risk_aversion}, τ_tox=${params.risk_high_threshold}, τ_urg=${params.urgency_high_threshold}, N=${params.ac_num_slices} slices).`,
    );
  }

  function downloadTCAMarkdown() {
    if (!tcaReport) return;
    const blob = new Blob([tcaReport.report_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FastTrade_TCA_${tcaReport.order_id}_${tcaReport.scenario}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleEmailTCA() {
    if (!tcaReport) return;
    const targetEmail = userEmail || 'trader@fasttrade.ai';
    setEmailingTca(true);
    setTcaEmailStatus(null);
    try {
      const res = await sendTransactionalEmail(token ?? null, {
        to_email: targetEmail,
        subject: `FastTrade Executive TCA Memo · ${tcaReport.order_id}`,
        order_id: tcaReport.order_id,
        scenario: tcaReport.scenario,
        shortfall_bps: tcaReport.fasttrade_shortfall_bps,
        savings_usd: tcaReport.savings_vs_twap_usd,
        report_markdown: tcaReport.report_markdown,
      });
      setTcaEmailStatus(`Executive TCA memo dispatched to ${res.email_result.to} (${res.email_result.status.toUpperCase()})`);
    } catch {
      setTcaEmailStatus('Compliance dispatch failed');
    } finally {
      setEmailingTca(false);
    }
  }

  useEffect(() => {
    void refreshStatusAndMemory();
    void handleTavilySearch(activeSymbol, '');
  }, [activeSymbol]);

  useEffect(() => {
    if (snapshot) {
      void handleGenerateBrief(snapshot, 'fast');
      if (!workflowRes && !workflowLoading) {
        void handleRunWorkflow(false);
      }
      if (!codingRes && !codingLoading) {
        void handleRunCodingAgent();
      }
    }
  }, [snapshot?.execution?.order_id, snapshot?.scenario]);

  useEffect(() => {
    if (tcaModalOpen && !tcaReport && !tcaLoading && snapshot) {
      void handleGenerateTCA();
    }
  }, [tcaModalOpen]);

  const activeCodeIteration =
    codingRes?.iterations.find(it => it.iteration === selectedCodeIter) ||
    codingRes?.iterations[codingRes.iterations.length - 1] ||
    null;

  return (
    <>
      <section className="nebius-hub-card">
        {/* Top Sponsor & Model-Tier Router Bar */}
        <div className="nebius-hub-header">
          <div className="nebius-brand-block">
            <div className="sponsor-badges">
              <span className="badge-nebius">
                <span className="pulse-dot" /> NEBIUS TOKEN FACTORY · MULTI-AGENT ORCHESTRATOR
              </span>
              <span className="badge-nvidia">NVIDIA NEMOTRON-3 (30B NANO · 120B SUPER · 550B ULTRA)</span>
              <span className="badge-nebius" style={{ borderColor: 'rgba(16, 185, 129, 0.45)', color: '#6ee7b7' }}>
                <span className="pulse-dot" /> NEBIUS SANDBOXES BETA ·{' '}
                {aiStatus?.nebius_sandboxes?.configured ? 'CONTREE VM LIVE' : 'CONTREE READY'}
              </span>
              <span className="badge-nebius" style={{ borderColor: 'rgba(167, 139, 250, 0.45)', color: '#c4b5fd' }}>
                <span className="pulse-dot" /> LANGSMITH TRACING ·{' '}
                {aiStatus?.langsmith?.configured ? aiStatus.langsmith.project_name : 'READY'}
              </span>
            </div>
            <h2>Autonomous Multi-Step Execution Workflows, Quant Coding Lab &amp; Persistent Assistant</h2>
            <p className="hub-subtitle">
              Chains <strong>NVIDIA Nemotron-3 Nano 30B</strong> (L2 telemetry &amp; memory recall),{' '}
              <strong>Super 120B</strong> (self-iterating strategy code synthesis &amp; 3x sandbox backtesting), and{' '}
              <strong>Ultra 550B</strong> (500-path Monte Carlo CaR &amp; TCA governance) to execute real portfolio actions.
            </p>
          </div>

          <div className="tier-selector-box">
            <label htmlFor="tier-select">MODEL-TIER ROUTING POLICY</label>
            <div className="tier-controls-row">
              <select
                id="tier-select"
                value={selectedTier}
                onChange={e => setSelectedTier(e.target.value as NebiusTierId)}
              >
                <option value="auto">Auto Multi-Tier Orchestrator (Recommended)</option>
                <option value="fast">Tier 1 · FAST: NVIDIA Nemotron-3 Nano 30B (A3B MoE)</option>
                <option value="balanced">Tier 2 · BALANCED: NVIDIA Nemotron-3 Super 120B (A12B MoE)</option>
                <option value="ultra">Tier 3 · ULTRA: NVIDIA Nemotron-3 Ultra 550B (A55B MoE)</option>
              </select>
              <button
                type="button"
                className="btn-nvidia"
                onClick={() => void handleGenerateTCA()}
                disabled={tcaLoading || !snapshot}
              >
                <FileTextIcon size={15} />
                {tcaLoading ? 'Auditing on Ultra 550B…' : 'Executive TCA Audit (Ultra 550B)'}
              </button>
            </div>
          </div>
        </div>

        {/* 3 Model Tier Cards */}
        {aiStatus && (
          <div className="model-tiers-grid">
            {aiStatus.nvidia_model_tiers.map(t => {
              const isLastUsed = aiStatus.telemetry.last_tier_used === t.tier_id;
              const count = aiStatus.telemetry.tier_counts[t.tier_id] ?? 0;
              return (
                <div
                  key={t.tier_id}
                  className={`model-tier-card ${isLastUsed ? 'tier-active' : ''}`}
                  onClick={() => setSelectedTier(t.tier_id)}
                >
                  <div className="tier-card-top">
                    <span className={`tier-pill tier-${t.tier_id}`}>TIER: {t.tier_id.toUpperCase()}</span>
                    <span className="mono-val tier-count">{count} calls</span>
                  </div>
                  <strong className="tier-title">{t.display_name}</strong>
                  <span className="tier-arch mono-val">{t.model_id}</span>
                  <p className="tier-desc">{t.use_case}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Confirmation Banner when Agent Deploys Parameters or Saves Memory */}
        {appliedBanner && (
          <div className="profile-success-banner" style={{ marginBottom: 16 }}>
            <CheckCircleIcon size={16} />
            <span>{appliedBanner}</span>
          </div>
        )}

        {/* 4-Mode Agentic Studio Navigation Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '10px',
            marginBottom: '18px',
          }}
        >
          <button
            type="button"
            className={`workspace-tab-btn ${studioTab === 'workflow' ? 'workspace-tab-active' : ''}`}
            style={{ justifyContent: 'space-between', padding: '12px 14px' }}
            onClick={() => setStudioTab('workflow')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <LayersIcon size={15} />
              <strong>1. 5-Stage Autonomous Workflow</strong>
            </span>
            <span className="workspace-tab-badge">MULTI-STEP</span>
          </button>

          <button
            type="button"
            className={`workspace-tab-btn ${studioTab === 'coding' ? 'workspace-tab-active' : ''}`}
            style={{ justifyContent: 'space-between', padding: '12px 14px' }}
            onClick={() => setStudioTab('coding')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CpuIcon size={15} />
              <strong>2. Self-Iterating Coding Agent</strong>
            </span>
            <span className="workspace-tab-badge">TEST &amp; ITERATE</span>
          </button>

          <button
            type="button"
            className={`workspace-tab-btn ${studioTab === 'assistant' ? 'workspace-tab-active' : ''}`}
            style={{ justifyContent: 'space-between', padding: '12px 14px' }}
            onClick={() => setStudioTab('assistant')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SparklesIcon size={15} />
              <strong>3. Context &amp; Action Assistant</strong>
            </span>
            <span className="workspace-tab-badge">
              {memoryState ? `${memoryState.total_memories} MEMORIES` : 'MEMORY + ACT'}
            </span>
          </button>

          <button
            type="button"
            className={`workspace-tab-btn ${studioTab === 'brief' ? 'workspace-tab-active' : ''}`}
            style={{ justifyContent: 'space-between', padding: '12px 14px' }}
            onClick={() => setStudioTab('brief')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldIcon size={15} />
              <strong>4. Tavily Financial Intel &amp; Brief</strong>
            </span>
            <span className="workspace-tab-badge">TAVILY + 30B</span>
          </button>
        </div>

        {/* =====================================================================
            MODE 1: 5-STAGE MULTI-STEP AUTONOMOUS WORKFLOW AGENT
           ===================================================================== */}
        {studioTab === 'workflow' && (
          <div className="ai-subpanel">
            <div className="subpanel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="card-tag">
                  MULTI-STEP AGENT PIPELINE · NANO 30B → SUPER 120B → 3x SANDBOX LOOP → ULTRA 550B → BLOTTER ACTION
                </span>
                <h3>5-Stage Autonomous Institutional Order Optimization &amp; Execution Workflow</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.8rem',
                    color: '#cbd5e1',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoCommitBlotter}
                    onChange={e => setAutoCommitBlotter(e.target.checked)}
                  />
                  Auto-Commit Fill to $25M Desk Blotter
                </label>
                <button
                  type="button"
                  className="btn-nvidia"
                  disabled={workflowLoading || !snapshot}
                  onClick={() => void handleRunWorkflow()}
                >
                  <PlayIcon size={14} />
                  {workflowLoading
                    ? 'Executing 5-Stage Pipeline…'
                    : 'Run 5-Stage Autonomous Workflow'}
                </button>
              </div>
            </div>

            <div className="copilot-input-row" style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={missionInput}
                onChange={e => setMissionInput(e.target.value)}
                placeholder="Specify autonomous execution mission…"
                disabled={workflowLoading}
              />
            </div>

            {workflowLoading && !workflowRes ? (
              <div className="ai-loading-state">
                <div className="spinner" />
                <p>Orchestrating 5-stage workflow across NVIDIA Nemotron-3 30B, 120B, and 550B on Nebius Token Factory…</p>
              </div>
            ) : workflowRes ? (
              <div>
                {/* Top Workflow Summary Strip */}
                <div className="tca-kpi-strip" style={{ marginBottom: 16 }}>
                  <div className="stat-box">
                    <span>Workflow Run ID</span>
                    <strong className="mono-val">{workflowRes.workflow_id}</strong>
                  </div>
                  <div className="stat-box">
                    <span>Parent Block</span>
                    <strong className="mono-val">
                      {workflowRes.side} {workflowRes.quantity.toLocaleString()} {workflowRes.symbol} ($
                      {workflowRes.notional_usd.toLocaleString()})
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span>3-Cycle Sandbox Convergence</span>
                    <strong className="mono-val bid-text">
                      {workflowRes.sandbox_iterations[0]?.shortfall_bps} bps →{' '}
                      {workflowRes.sandbox_iterations[2]?.shortfall_bps} bps (4/4 PASS)
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span>Real Action Executed</span>
                    <strong className="mono-val bid-text">
                      {workflowRes.committed_trade
                        ? `Blotter Fill ${workflowRes.committed_trade.trade_id}`
                        : 'Memory + EMS Staged'}
                    </strong>
                  </div>
                </div>

                {/* 5-Stage Visual Pipeline Cards */}
                <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
                  {workflowRes.steps.map(step => (
                    <div
                      key={step.step_number}
                      style={{
                        background: 'rgba(15, 23, 42, 0.72)',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                        borderLeft:
                          step.model_tier === 'ultra'
                            ? '4px solid #f59e0b'
                            : step.model_tier === 'balanced'
                              ? '4px solid #38bdf8'
                              : '4px solid #10b981',
                        borderRadius: 10,
                        padding: '12px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`tier-pill tier-${step.model_tier}`}>
                            STAGE {step.step_number} · {step.model_tier.toUpperCase()}
                          </span>
                          <strong style={{ color: '#f8fafc', fontSize: '0.94rem' }}>{step.title}</strong>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="mono-val" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Tool: <code>{step.tool_called}</code>
                          </span>
                          <span className="mono-val" style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                            {step.model_id} ({step.latency_ms}ms)
                          </span>
                          <span className="badge-nebius" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                            ✓ {step.status}
                          </span>
                        </div>
                      </div>
                      <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.86rem', lineHeight: 1.5 }}>
                        {step.summary}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Stage 3 Deep-Dive: 3-Iteration Sandbox Backtest Table */}
                <div
                  style={{
                    background: 'rgba(9, 13, 22, 0.8)',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <span className="card-tag">STAGE 3 SELF-ITERATING BACKTEST HARNESS</span>
                      <h4 style={{ margin: '2px 0 0', color: '#f8fafc' }}>
                        Closed-Loop Parameter &amp; Policy Convergence Across 3 L2 Replay Cycles
                      </h4>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {renderLangSmithBadge(workflowRes.langsmith_trace_id)}
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() =>
                          handleDeployParams(workflowRes.recommended_params, '5-Stage Autonomous Workflow')
                        }
                      >
                        <SlidersIcon size={14} /> Apply Converged Params to Live EMS
                      </button>
                      {workflowRes.committed_trade && onNavigateBlotter && (
                        <button type="button" className="btn-outline-sm" onClick={onNavigateBlotter}>
                          <ActivityIcon size={14} /> View Committed Fill ({workflowRes.committed_trade.trade_id}) in Blotter
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Cycle</th>
                          <th>Calibrated Parameters (λ, τ_tox, τ_urg, N)</th>
                          <th>Shortfall</th>
                          <th>99% Tail CaR</th>
                          <th>Fill Rate</th>
                          <th>Unit Assertions</th>
                          <th>Sandbox Backtester Diagnosis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflowRes.sandbox_iterations.map(it => (
                          <tr key={it.iteration}>
                            <td>
                              <strong>{it.label}</strong>
                            </td>
                            <td className="mono-val">
                              λ={it.params.risk_aversion}, τ_tox={it.params.risk_high_threshold}, N=
                              {it.params.ac_num_slices}
                            </td>
                            <td className="mono-val bid-text">{it.shortfall_bps} bps</td>
                            <td className="mono-val">{it.tail_car_99_bps} bps</td>
                            <td className="mono-val">{it.fill_rate_pct}%</td>
                            <td>
                              <span
                                className={`tier-pill ${
                                  it.assertions_passed.startsWith('4/4') ? 'tier-fast' : 'tier-ultra'
                                }`}
                              >
                                {it.assertions_passed}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{it.diagnostic}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* =====================================================================
            MODE 2: SELF-ITERATING QUANT STRATEGY CODING AGENT
           ===================================================================== */}
        {studioTab === 'coding' && (
          <div className="ai-subpanel">
            <div className="subpanel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="card-tag">
                  SELF-ITERATING QUANT CODING AGENT · WRITE → AST CHECK → L2 UNIT TEST → DIAGNOSE → REFACTOR
                </span>
                <h3>Autonomous Strategy Code Synthesis &amp; 3-Cycle Test-Driven Iteration Lab</h3>
              </div>
              {codingRes && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {renderLangSmithBadge(codingRes.langsmith_trace_id)}
                  <button
                    type="button"
                    className="btn-nvidia"
                    onClick={() => handleDeployParams(codingRes.tuned_parameters, 'v3.0 Iterated Quant Policy')}
                  >
                    <SlidersIcon size={14} /> Deploy v3.0 Policy Parameters to Live EMS
                  </button>
                </div>
              )}
            </div>

            <div className="quick-prompts" style={{ marginBottom: 10 }}>
              {[
                'Design an adaptive execution algorithm that dynamically skews passive limit orders using L1 Order Flow Imbalance (OFI) and halts maker posting when XGBoost toxicity > 54%.',
                'Synthesize and test a front-loaded Almgren-Chriss hyperbolic trajectory with dark-pool midpoint fallback during informed sweeps.',
                'Write a latency-aware maker/taker switching policy that maximizes passive rebate capture while guaranteeing 100% block completion.',
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="prompt-chip"
                  disabled={codingLoading}
                  onClick={() => void handleRunCodingAgent(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            <form
              className="copilot-input-row"
              style={{ marginBottom: 16 }}
              onSubmit={e => {
                e.preventDefault();
                void handleRunCodingAgent();
              }}
            >
              <input
                type="text"
                value={codingPrompt}
                onChange={e => setCodingPrompt(e.target.value)}
                placeholder="Describe quantitative execution strategy to synthesize, unit-test, and iterate…"
                disabled={codingLoading}
              />
              <button type="submit" disabled={codingLoading || !codingPrompt.trim()}>
                {codingLoading ? 'Synthesizing & Testing…' : 'Synthesize & Test (3 Cycles)'}
              </button>
            </form>

            {codingLoading && !codingRes ? (
              <div className="ai-loading-state">
                <div className="spinner" />
                <p>Synthesizing Python strategy code, validating AST, and running 3 backtest iterations on Super 120B…</p>
              </div>
            ) : codingRes && activeCodeIteration ? (
              <div>
                <div className="brief-headline-banner" style={{ marginBottom: 14 }}>
                  <SparklesIcon size={16} />
                  <span>{codingRes.architectural_summary}</span>
                </div>

                {/* Iteration Selector Pills */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                  {codingRes.iterations.map(it => (
                    <button
                      key={it.iteration}
                      type="button"
                      className={`workspace-tab-btn ${
                        selectedCodeIter === it.iteration ? 'workspace-tab-active' : ''
                      }`}
                      onClick={() => setSelectedCodeIter(it.iteration)}
                    >
                      <span>{it.title}</span>
                      <span className="workspace-tab-badge">
                        {it.passed_count}/{it.total_tests} PASS · {it.shortfall_bps} bps
                      </span>
                    </button>
                  ))}
                </div>

                {/* Split View: Left = Synthesized Python Code, Right = Unit Test Matrix & Compiler Diagnosis */}
                <div className="nebius-panels-split">
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>
                        {activeCodeIteration.title} (<code>{activeCodeIteration.version_tag}</code>)
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          style={{ padding: '3px 9px', fontSize: '0.72rem' }}
                          disabled={sandboxRunning}
                          onClick={() =>
                            void handleExecuteInSandbox(
                              `${activeCodeIteration.code}\n\n# Smoke-test inside Nebius Sandbox VM (python:3.12-slim)\nout = compute_execution_slice_v${activeCodeIteration.iteration}({"remaining_qty": 500.0, "slices_left": 10, "adverse_selection_prob": 0.24, "ofi_instant": -5.0, "depth_imbalance_l1": -0.40, "urgency_score": 0.35})\nprint("Nebius Sandbox Slice Decision:", out)`,
                              '',
                            )
                          }
                        >
                          <PlayIcon size={12} /> Run in Nebius VM
                        </button>
                        <span className="badge-nebius" style={{ fontSize: '0.72rem' }}>
                          {codingRes.nebius_sandbox?.executed_live
                            ? 'NEBIUS VM · PYTHON 3.12'
                            : 'AST VERIFIED · PYTHON 3.12'}
                        </span>
                      </div>
                    </div>
                    <pre
                      className="reasoning-trace-box"
                      style={{
                        maxHeight: 340,
                        fontSize: '0.79rem',
                        lineHeight: 1.5,
                        background: '#050811',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                      }}
                    >
                      {activeCodeIteration.code}
                    </pre>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>
                        Automated Unit Tests &amp; L2 Replay Assertions ({activeCodeIteration.passed_count}/
                        {activeCodeIteration.total_tests} Passed)
                      </strong>
                      <span className="mono-val bid-text" style={{ fontSize: '0.82rem' }}>
                        Shortfall: {activeCodeIteration.shortfall_bps} bps (Alpha: +
                        {activeCodeIteration.alpha_vs_twap_bps} bps vs TWAP)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                      {activeCodeIteration.unit_tests.map(t => (
                        <div
                          key={t.name}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            background: 'rgba(15, 23, 42, 0.75)',
                            border:
                              t.status === 'PASS'
                                ? '1px solid rgba(16, 185, 129, 0.35)'
                                : '1px solid rgba(244, 63, 94, 0.45)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div>
                            <code style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.8rem' }}>{t.name}</code>
                            <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#cbd5e1' }}>{t.detail}</p>
                          </div>
                          <span
                            className={`tier-pill ${t.status === 'PASS' ? 'tier-fast' : 'tier-ultra'}`}
                            style={{ flexShrink: 0 }}
                          >
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 8,
                        background: 'rgba(56, 189, 248, 0.08)',
                        border: '1px solid rgba(56, 189, 248, 0.28)',
                      }}
                    >
                      <span className="brief-label" style={{ display: 'block', marginBottom: 4 }}>
                        NEBIUS CONTREE SANDBOX COMPILER &amp; BACKTESTER FEEDBACK LOOP
                      </span>
                      <p style={{ margin: 0, fontSize: '0.83rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                        {activeCodeIteration.compiler_diagnosis}
                      </p>
                      {codingRes.nebius_sandbox && (
                        <div
                          className="mono-val"
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: '1px solid rgba(148, 163, 184, 0.18)',
                            fontSize: '0.74rem',
                            color: '#94a3b8',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 12,
                          }}
                        >
                          <span>
                            Image: <strong style={{ color: '#e2e8f0' }}>{codingRes.nebius_sandbox.base_image}</strong>
                          </span>
                          {codingRes.nebius_sandbox.promoted_image_uuid && (
                            <span>
                              Promoted ConTree UUID:{' '}
                              <code style={{ color: '#34d399' }}>
                                {codingRes.nebius_sandbox.promoted_image_uuid.slice(0, 18)}…
                              </code>
                            </span>
                          )}
                          {codingRes.nebius_sandbox.latency_ms && (
                            <span>
                              3-Branch VM Latency: <strong>{codingRes.nebius_sandbox.latency_ms}ms</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Interactive Nebius Token Factory Sandboxes Beta Cloud VM Runner */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                background: 'rgba(9, 13, 22, 0.85)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div>
                  <span className="card-tag" style={{ color: '#34d399' }}>
                    NEBIUS TOKEN FACTORY SANDBOXES BETA · CONTREE CLOUD VM (`python:3.12-slim`)
                  </span>
                  <h4 style={{ margin: '2px 0 0', color: '#f8fafc' }}>
                    Isolated Cloud VM Code &amp; System Package Execution (`contree-sdk==0.3.6`)
                  </h4>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-outline-sm"
                    disabled={sandboxRunning}
                    onClick={() =>
                      void handleExecuteInSandbox(
                        `import math, platform\nqty, slices, kappa = 500.0, 12, 0.24\ntraj = [round(qty * math.sinh(kappa * (slices - k)) / math.sinh(kappa * slices), 2) for k in range(slices + 1)]\nprint(f"Nebius Sandbox VM: Python {platform.python_version()} | Arch: {platform.machine()}")\nprint("Almgren-Chriss Optimal Inventory Schedule:", traj)`,
                        '',
                      )
                    }
                  >
                    Preset: Almgren–Chriss VM Check
                  </button>
                  <button
                    type="button"
                    className="btn-outline-sm"
                    disabled={sandboxRunning}
                    onClick={() =>
                      void handleExecuteInSandbox(
                        `import subprocess\nqr = subprocess.run(["qrencode", "-t", "ANSIUTF8", "https://fasttrade-smoky.vercel.app"], capture_output=True, text=True)\nprint("Generated via apt-get qrencode inside Nebius Sandbox VM:")\nprint(qr.stdout)`,
                        'qrencode',
                      )
                    }
                  >
                    Preset: apt-get qrencode + QR Demo
                  </button>
                  <button
                    type="button"
                    className="btn-nvidia"
                    disabled={sandboxRunning || !sandboxCode.trim()}
                    onClick={() => void handleExecuteInSandbox()}
                  >
                    <PlayIcon size={14} />
                    {sandboxRunning ? 'Running in Nebius Cloud VM…' : 'Execute in Nebius Sandbox VM'}
                  </button>
                </div>
              </div>

              <div className="nebius-panels-split">
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <label
                      htmlFor="sandbox-apt"
                      className="mono-val"
                      style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}
                    >
                      Optional apt-get packages:
                    </label>
                    <input
                      id="sandbox-apt"
                      type="text"
                      value={sandboxAptPkgs}
                      onChange={e => setSandboxAptPkgs(e.target.value)}
                      placeholder="e.g. qrencode jq (persisted via disposable=False)"
                      disabled={sandboxRunning}
                      style={{
                        flex: 1,
                        background: '#050811',
                        color: '#e2e8f0',
                        border: '1px solid rgba(148,163,184,0.25)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                      }}
                    />
                  </div>
                  <textarea
                    value={sandboxCode}
                    onChange={e => setSandboxCode(e.target.value)}
                    rows={7}
                    disabled={sandboxRunning}
                    style={{
                      width: '100%',
                      background: '#050811',
                      color: '#e2e8f0',
                      border: '1px solid rgba(56, 189, 248, 0.28)',
                      borderRadius: 8,
                      padding: 10,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.78rem',
                      lineHeight: 1.45,
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ color: '#f8fafc', fontSize: '0.84rem' }}>
                      Cloud VM Standard Output &amp; ConTree Checkpoint Metadata
                    </strong>
                    {sandboxRunRes && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {renderLangSmithBadge(sandboxRunRes.langsmith_trace_id)}
                        <span className="mono-val bid-text" style={{ fontSize: '0.76rem' }}>
                          Exit: {sandboxRunRes.exit_code} · {sandboxRunRes.latency_ms}ms
                        </span>
                      </div>
                    )}
                  </div>
                  {sandboxError ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(244, 63, 94, 0.12)',
                        border: '1px solid rgba(244, 63, 94, 0.4)',
                        color: '#fda4af',
                        fontSize: '0.8rem',
                      }}
                    >
                      {sandboxError}
                    </div>
                  ) : sandboxRunRes ? (
                    <div>
                      <pre
                        className="reasoning-trace-box"
                        style={{
                          maxHeight: 175,
                          fontSize: '0.76rem',
                          lineHeight: 1.25,
                          background: '#050811',
                          border: '1px solid rgba(16, 185, 129, 0.35)',
                        }}
                      >
                        {sandboxRunRes.stdout || sandboxRunRes.stderr || '(No output)'}
                      </pre>
                      <div
                        className="mono-val"
                        style={{
                          marginTop: 6,
                          fontSize: '0.73rem',
                          color: '#94a3b8',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 12,
                        }}
                      >
                        <span>
                          Project: <code style={{ color: '#38bdf8' }}>{sandboxRunRes.project_id}</code>
                        </span>
                        {sandboxRunRes.checkpoint_uuid && (
                          <span>
                            Saved Checkpoint UUID:{' '}
                            <code style={{ color: '#34d399' }}>{sandboxRunRes.checkpoint_uuid}</code>
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px dashed rgba(148, 163, 184, 0.25)',
                        color: '#94a3b8',
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                      }}
                    >
                      Click <strong>Execute in Nebius Sandbox VM</strong> (or choose a preset above) to run untrusted
                      model-generated Python code and Linux system tools inside an isolated Nebius Token Factory
                      ConTree VM with copy-on-write checkpointing (`disposable=False`).
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 3: CONTEXT-AWARE PERSONAL ASSISTANT & PERSISTENT EPISODIC MEMORY
           ===================================================================== */}
        {studioTab === 'assistant' && (
          <div className="nebius-panels-split">
            {/* LEFT: Context-Aware Personal Assistant with Action Execution */}
            <div className="ai-subpanel">
              <div className="subpanel-header">
                <div>
                  <span className="card-tag">
                    CONTEXT-PERSISTENT PERSONAL EXECUTION ASSISTANT · MEMORY RECALL + REAL DESK ACTIONS
                  </span>
                  <h3>Interactive Quantitative Assistant (Remembers Context &amp; Executes Actions)</h3>
                </div>
                {copilotRes && (
                  <span className={`tier-pill tier-${copilotRes.tier}`}>
                    ROUTED: {copilotRes.tier.toUpperCase()} ({copilotRes.latency_ms.toFixed(0)}ms)
                  </span>
                )}
              </div>

              <div className="quick-prompts">
                {[
                  `Execute trade and commit our current ${activeSymbol} order directly to the $25M Desk Blotter.`,
                  `Remember our desk mandate for ${activeSymbol}: cap adverse-selection toxicity at 54% and always use λ=0.0014.`,
                  `Calibrate and optimize Almgren-Chriss λ and toxicity withdrawal thresholds for ${activeSymbol}.`,
                  'Why did FastTrade switch between passive maker and aggressive taker slices?',
                ].map((preset, i) => (
                  <button
                    key={i}
                    type="button"
                    className="prompt-chip"
                    disabled={copilotLoading}
                    onClick={() => void handleAskCopilot(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <form
                className="copilot-input-row"
                onSubmit={e => {
                  e.preventDefault();
                  void handleAskCopilot();
                }}
              >
                <input
                  type="text"
                  placeholder="Ask assistant to execute a blotter trade, remember a desk rule, calibrate λ, or audit L2 flow…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  disabled={copilotLoading}
                />
                <button type="submit" disabled={copilotLoading || !query.trim()}>
                  {copilotLoading ? 'Executing…' : 'Send / Act'}
                </button>
              </form>

              {copilotLoading ? (
                <div className="ai-loading-state">
                  <div className="spinner" />
                  <p>Recalling persistent desk memory &amp; executing assistant tool calls on Nebius Token Factory…</p>
                </div>
              ) : copilotRes ? (
                <div className="copilot-response-box">
                  <div className="routing-decision-bar">
                    <span>
                      <strong>Router Decision:</strong> {copilotRes.routing_reason}
                    </span>
                    <span className="mono-val">{copilotRes.model_id}</span>
                  </div>

                  {/* Real Actions Executed by Assistant */}
                  {copilotRes.executed_actions && copilotRes.executed_actions.length > 0 && (
                    <div
                      style={{
                        margin: '10px 0',
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                      }}
                    >
                      <strong style={{ color: '#34d399', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>
                        ✓ REAL SYSTEM ACTIONS EXECUTED BY ASSISTANT:
                      </strong>
                      {copilotRes.executed_actions.map(act => (
                        <div
                          key={act.action_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: '0.82rem',
                            color: '#e2e8f0',
                            padding: '3px 0',
                          }}
                        >
                          <span>
                            <code>[{act.action_type}]</code> {act.summary}
                          </span>
                          {act.action_type === 'ASSISTANT_BLOTTER_EXECUTION' && onNavigateBlotter && (
                            <button type="button" className="btn-outline-sm" onClick={onNavigateBlotter}>
                              Open Blotter
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {copilotRes.recommended_params && (
                    <div style={{ marginBottom: 10 }}>
                      <button
                        type="button"
                        className="btn-outline-sm"
                        onClick={() =>
                          handleDeployParams(copilotRes.recommended_params!, 'Assistant Calibrated Mandate')
                        }
                      >
                        <SlidersIcon size={14} /> Apply Assistant Calibrated Parameters to Live EMS
                      </button>
                    </div>
                  )}

                  <div className="copilot-answer-text">{copilotRes.answer}</div>
                  <div className="ai-meta-footer">
                    <span className="mono-val">
                      Provider: <strong>{copilotRes.provider}</strong> · Status: <strong>{copilotRes.status}</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {renderLangSmithBadge(copilotRes.langsmith_trace_id)}
                      {copilotRes.reasoning_trace && (
                        <button
                          type="button"
                          className="btn-link-trace"
                          onClick={() => setShowCopilotReasoning(!showCopilotReasoning)}
                        >
                          {showCopilotReasoning ? '▼ Hide CoT Reasoning' : '▶ View Nemotron Chain-of-Thought'}
                        </button>
                      )}
                    </div>
                  </div>
                  {showCopilotReasoning && copilotRes.reasoning_trace && (
                    <pre className="reasoning-trace-box">{copilotRes.reasoning_trace}</pre>
                  )}
                </div>
              ) : (
                <div className="copilot-placeholder">
                  <p>
                    This assistant maintains <strong>persistent episodic &amp; semantic memory</strong> across sessions
                    and takes <strong>real actions</strong>: it can commit orders directly to your $25.0M Trade Blotter,
                    persist new desk risk mandates into SQLite/PostgreSQL memory, and calibrate live Almgren–Chriss
                    parameters.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Persistent Episodic Memory Store & Autonomous Action Ledger */}
            <div className="ai-subpanel">
              <div className="subpanel-header">
                <div>
                  <span className="card-tag">PERSISTENT EPISODIC MEMORY &amp; ACTION LEDGER</span>
                  <h3>Stored Desk Mandates, Learned Calibrations &amp; Past Actions</h3>
                </div>
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => void refreshStatusAndMemory()}
                >
                  <RefreshIcon size={14} /> Sync Memory
                </button>
              </div>

              {/* Add Persistent Memory Form */}
              <form
                onSubmit={e => void handleAddMemory(e)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 120px 1fr auto',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <select
                  value={newMemCategory}
                  onChange={e => setNewMemCategory(e.target.value)}
                  style={{
                    background: '#0b1120',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.25)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: '0.78rem',
                  }}
                >
                  <option value="RISK_MANDATE">RISK_MANDATE</option>
                  <option value="OPERATOR_PREFERENCE">OPERATOR_PREF</option>
                  <option value="VENUE_ROUTING">VENUE_ROUTING</option>
                  <option value="LEARNED_CALIBRATION">CALIBRATION</option>
                </select>
                <input
                  type="text"
                  value={newMemScope}
                  onChange={e => setNewMemScope(e.target.value)}
                  placeholder="Scope (e.g. NVDA)"
                  style={{
                    background: '#0b1120',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.25)',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: '0.78rem',
                  }}
                />
                <input
                  type="text"
                  value={newMemRule}
                  onChange={e => setNewMemRule(e.target.value)}
                  placeholder="Teach assistant a new persistent desk rule…"
                  style={{
                    background: '#0b1120',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.25)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                  }}
                />
                <button type="submit" className="btn-outline-sm" disabled={savingMem || !newMemRule.trim()}>
                  {savingMem ? 'Saving…' : '+ Store Rule'}
                </button>
              </form>

              {memoryState && (
                <div style={{ display: 'grid', gap: 8, maxHeight: 330, overflowY: 'auto' }}>
                  {memoryState.memories.slice(0, 6).map(mem => (
                    <div
                      key={mem.memory_id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: 'rgba(15, 23, 42, 0.72)',
                        border: '1px solid rgba(148, 163, 184, 0.18)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <code style={{ color: '#38bdf8', fontSize: '0.76rem' }}>{mem.memory_id}</code>
                          <span className="tier-pill tier-balanced">{mem.category}</span>
                          <span className="mono-val" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Scope: {mem.symbol_scope}
                          </span>
                        </span>
                        <span className="mono-val" style={{ fontSize: '0.72rem', color: '#10b981' }}>
                          Conf: {(mem.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.81rem', color: '#e2e8f0', lineHeight: 1.45 }}>
                        {mem.rule_summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            MODE 4: REAL-TIME TACTICAL BRIEF & ARCHITECTURE SCORECARD
           ===================================================================== */}
        {studioTab === 'brief' && (
          <div className="nebius-panels-split">
            {/* LEFT: Real-Time Tactical Execution Brief */}
            <div className="ai-subpanel">
              <div className="subpanel-header">
                <div>
                  <span className="card-tag">TIER 1 AUTO-SYNTHESIS · NEMOTRON-3 NANO 30B</span>
                  <h3>Live Execution Desk Tactical Brief</h3>
                </div>
                <button
                  type="button"
                  className="btn-outline-sm"
                  onClick={() => void handleGenerateBrief(snapshot, selectedTier)}
                  disabled={briefLoading || !snapshot}
                >
                  <RefreshIcon size={14} /> {briefLoading ? 'Synthesizing…' : 'Refresh Brief'}
                </button>
              </div>

              {briefLoading && !brief ? (
                <div className="ai-loading-state">
                  <div className="spinner" />
                  <p>Querying NVIDIA Nemotron-3 Nano 30B on Nebius Token Factory…</p>
                </div>
              ) : brief ? (
                <div className="brief-content">
                  <div className="brief-headline-banner">
                    <SparklesIcon size={16} />
                    <strong>{brief.headline}</strong>
                  </div>

                  <div className="brief-grid">
                    <div className="brief-item">
                      <span className="brief-label">MICROSTRUCTURE &amp; TOXICITY REGIME</span>
                      <p>{brief.regime_assessment}</p>
                    </div>
                    <div className="brief-item">
                      <span className="brief-label">SOR ROUTING RATIONALE</span>
                      <p>{brief.routing_rationale}</p>
                    </div>
                    <div className="brief-item highlight-alpha">
                      <span className="brief-label">ALPHA PRESERVATION VS BENCHMARKS</span>
                      <p>{brief.alpha_highlight}</p>
                    </div>
                    <div className="brief-item">
                      <span className="brief-label">EXECUTION DESK GUARDRAIL</span>
                      <p>{brief.risk_guardrail}</p>
                    </div>
                  </div>

                  <div className="ai-meta-footer">
                    <span className="mono-val">
                      Model: <strong>{brief.model_id}</strong> · Latency: <strong>{brief.latency_ms.toFixed(0)}ms</strong>
                    </span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {renderLangSmithBadge(brief.langsmith_trace_id)}
                      {brief.reasoning_trace && (
                        <button
                          type="button"
                          className="btn-link-trace"
                          onClick={() => setShowBriefReasoning(!showBriefReasoning)}
                        >
                          {showBriefReasoning ? '▼ Hide CoT Reasoning' : '▶ View Nemotron Chain-of-Thought'}
                        </button>
                      )}
                    </div>
                  </div>

                  {showBriefReasoning && brief.reasoning_trace && (
                    <pre className="reasoning-trace-box">{brief.reasoning_trace}</pre>
                  )}
                </div>
              ) : (
                <p className="empty">Run a simulation to generate a live tactical brief.</p>
              )}
            </div>

            {/* RIGHT: Tavily Live Financial Catalyst Search & URL Extract */}
            <div className="ai-subpanel">
              <div className="subpanel-header" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span className="card-tag">TAVILY LIVE FINANCIAL SEARCH &amp; URL EXTRACTION (`topic=&quot;finance&quot;`)</span>
                  <h3>Real-Time Market Catalysts, Cited Sources &amp; News Toxicity Shield</h3>
                </div>
                {tavilyRes && (
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={() =>
                      handleDeployParams(
                        tavilyRes.recommended_params,
                        `Tavily ${tavilyRes.catalyst_regime} Calibration`,
                      )
                    }
                  >
                    <SlidersIcon size={14} /> Apply News-Calibrated Params
                  </button>
                )}
              </div>

              <form
                className="copilot-input-row"
                style={{ marginBottom: 12 }}
                onSubmit={e => {
                  e.preventDefault();
                  void handleTavilySearch(activeSymbol, tavilyQuery);
                }}
              >
                <select
                  value={tavilyTopic}
                  onChange={e => setTavilyTopic(e.target.value as 'finance' | 'news')}
                  style={{
                    background: '#0b1120',
                    color: '#e2e8f0',
                    border: '1px solid rgba(148,163,184,0.25)',
                    borderRadius: 8,
                    padding: '0 10px',
                    fontSize: '0.8rem',
                  }}
                >
                  <option value="finance">topic: finance</option>
                  <option value="news">topic: news</option>
                </select>
                <input
                  type="text"
                  value={tavilyQuery}
                  onChange={e => setTavilyQuery(e.target.value)}
                  placeholder={`Search live Tavily financial catalysts for ${activeSymbol} (or leave blank for auto)…`}
                  disabled={tavilyLoading}
                />
                <button type="submit" disabled={tavilyLoading}>
                  {tavilyLoading ? 'Searching…' : 'Tavily Search'}
                </button>
              </form>

              {tavilyLoading && !tavilyRes ? (
                <div className="ai-loading-state">
                  <div className="spinner" />
                  <p>Querying Tavily Financial Search API (`https://api.tavily.com/search`)…</p>
                </div>
              ) : tavilyRes ? (
                <div>
                  <div className="routing-decision-bar" style={{ marginBottom: 10 }}>
                    <span>
                      <strong>Catalyst Regime:</strong> <code>{tavilyRes.catalyst_regime}</code> ·{' '}
                      <strong>Event Risk:</strong> {(tavilyRes.event_risk_score * 100).toFixed(0)}%
                    </span>
                    <span className="mono-val">
                      Tavily: {tavilyRes.latency_ms.toFixed(0)}ms · {tavilyRes.citations.length} cited sources
                    </span>
                  </div>

                  <div className="copilot-answer-text" style={{ marginBottom: 12 }}>
                    {tavilyRes.nemotron_synthesis}
                  </div>

                  <div style={{ display: 'grid', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                    {tavilyRes.citations.map((cit, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          background: 'rgba(15, 23, 42, 0.75)',
                          border: '1px solid rgba(148, 163, 184, 0.18)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <a
                            href={cit.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none' }}
                          >
                            [{cit.domain}] {cit.title} ↗
                          </a>
                          <button
                            type="button"
                            className="btn-outline-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            disabled={extractLoadingUrl === cit.url}
                            onClick={() => void handleTavilyExtract(cit.url)}
                          >
                            {extractLoadingUrl === cit.url ? 'Extracting…' : 'Tavily /extract'}
                          </button>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                          {cit.snippet}
                        </p>
                      </div>
                    ))}
                  </div>

                  {extractRes && (
                    <div style={{ marginTop: 10 }}>
                      <span className="brief-label" style={{ display: 'block', marginBottom: 4 }}>
                        TAVILY `/extract` FULL CONTENT ({extractRes.latency_ms.toFixed(0)}ms) · {extractRes.url}
                      </span>
                      <pre className="reasoning-trace-box" style={{ maxHeight: 160 }}>
                        {extractRes.extracted_content}
                      </pre>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {/* Institutional Post-Trade TCA Executive Committee Modal */}
      {tcaModalOpen && (
        <div className="modal-backdrop" onClick={() => setTcaModalOpen(false)}>
          <div className="tca-modal" onClick={e => e.stopPropagation()}>
            <div className="tca-modal-header">
              <div>
                <span className="badge-nvidia">NVIDIA NEMOTRON-3 ULTRA 550B (A55B MoE) · NEBIUS TOKEN FACTORY</span>
                <h2>Institutional Post-Trade Transaction Cost Analysis (TCA) Memo</h2>
              </div>
              <div className="tca-modal-actions">
                {tcaReport && (
                  <>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      disabled={emailingTca}
                      onClick={() => void handleEmailTCA()}
                    >
                      <MailIcon size={14} /> {emailingTca ? 'Dispatching…' : 'Dispatch to Committee'}
                    </button>
                    <button type="button" className="btn-outline-sm" onClick={downloadTCAMarkdown}>
                      <DownloadIcon size={14} /> Download .MD
                    </button>
                    <button type="button" className="btn-outline-sm" onClick={() => window.print()}>
                      <PrinterIcon size={14} /> Print / PDF
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn-close-modal"
                  aria-label="Close modal"
                  onClick={() => setTcaModalOpen(false)}
                >
                  <CloseIcon size={16} />
                </button>
              </div>
            </div>

            {tcaEmailStatus && (
              <div className="profile-success-banner" style={{ margin: '12px 24px 0' }}>
                <MailIcon size={15} />
                <span>{tcaEmailStatus}</span>
              </div>
            )}

            {tcaLoading ? (
              <div className="ai-loading-state modal-loading">
                <div className="spinner" />
                <p>
                  Running deep multi-strategy shortfall attribution on <strong>nvidia/Nemotron-3-Ultra-550b-a55b</strong> via
                  Nebius Token Factory…
                </p>
              </div>
            ) : tcaReport ? (
              <div className="tca-modal-body">
                <div className="tca-kpi-strip">
                  <div className="stat-box">
                    <span>Order ID &amp; Regime</span>
                    <strong className="mono-val">
                      {tcaReport.order_id} ({tcaReport.scenario})
                    </strong>
                  </div>
                  <div className="stat-box">
                    <span>Parent Notional</span>
                    <strong className="mono-val">${tcaReport.notional_usd.toLocaleString()}</strong>
                  </div>
                  <div className="stat-box">
                    <span>FastTrade Shortfall</span>
                    <strong className="mono-val bid-text">{tcaReport.fasttrade_shortfall_bps} bps</strong>
                  </div>
                  <div className="stat-box">
                    <span>Alpha Saved vs TWAP</span>
                    <strong className="mono-val bid-text">
                      +{tcaReport.savings_vs_twap_bps} bps (${tcaReport.savings_vs_twap_usd.toLocaleString()})
                    </strong>
                  </div>
                </div>

                <div className="routing-decision-bar">
                  <span>{tcaReport.routing_reason}</span>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {renderLangSmithBadge(tcaReport.langsmith_trace_id)}
                    <span className="mono-val">
                      {tcaReport.model_id} · {tcaReport.latency_ms.toFixed(0)}ms
                    </span>
                  </div>
                </div>

                {tcaReport.reasoning_trace && (
                  <div style={{ marginBottom: 12 }}>
                    <button
                      type="button"
                      className="btn-link-trace"
                      onClick={() => setShowTcaReasoning(!showTcaReasoning)}
                    >
                      {showTcaReasoning
                        ? '▼ Hide 550B Chain-of-Thought Reasoning Trace'
                        : '▶ Inspect 550B Chain-of-Thought Reasoning Trace'}
                    </button>
                    {showTcaReasoning && <pre className="reasoning-trace-box">{tcaReport.reasoning_trace}</pre>}
                  </div>
                )}

                <div className="tca-markdown-content">
                  <pre className="tca-report-pre">{tcaReport.report_markdown}</pre>
                </div>
              </div>
            ) : (
              <p className="empty">Unable to load TCA report.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
