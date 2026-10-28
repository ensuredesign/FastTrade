import { useEffect, useState, type ReactNode } from 'react';
import {
  demoLogin,
  executePortfolioTrade,
  getCurrentUser,
  getDashboardSnapshot,
  getLiveMarketData,
  getPortfolioAndBlotter,
  runDashboard,
} from './api';
import type {
  AuthResponse,
  DashboardSnapshot,
  LiveMarketSnapshot,
  PortfolioAndBlotterResponse,
  RunOptions,
  ScenarioKey,
  Side,
  UserAccount,
} from './types';
import { OrderBook } from './components/OrderBook';
import { MarketFeatures } from './components/MarketFeatures';
import { Execution } from './components/Execution';
import { Risk } from './components/Risk';
import { ACSchedule } from './components/ACSchedule';
import { Forecast } from './components/Forecast';
import { Performance } from './components/Performance';
import { NebiusAIPanel } from './components/NebiusAIPanel';
import { VenueRouterCard } from './components/VenueRouterCard';
import { PreTradeStressCard } from './components/PreTradeStressCard';
import { GlobalMarketTickerBar, MarketOverviewHub } from './components/MarketOverviewHub';
import { PortfolioBlotterTab } from './components/PortfolioBlotterTab';
import { AuthScreen } from './components/AuthScreen';
import { ProfileModal } from './components/ProfileModal';
import { AdminPanel } from './components/AdminPanel';
import {
  ActivityIcon,
  AlertTriangleIcon,
  BarChartIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CloseIcon,
  CpuIcon,
  FastTradeLogo,
  FileTextIcon,
  GlobeIcon,
  LayersIcon,
  LogOutIcon,
  MenuIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  ShieldIcon,
  SlidersIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserIcon,
} from './components/Icons';

export type NavPillarId = 'markets' | 'execution' | 'portfolio' | 'quant_gov';

export type WorkspaceTab =
  | 'overview'
  | 'screener'
  | 'ems'
  | 'sor_tca'
  | 'stress'
  | 'portfolio'
  | 'blotter'
  | 'signals'
  | 'copilot'
  | 'governance';

interface SubTabItem {
  id: WorkspaceTab;
  pillar: NavPillarId;
  label: string;
  shortDesc: string;
  badge?: string;
  icon: ReactNode;
}

interface NavPillarItem {
  id: NavPillarId;
  label: string;
  subtitle: string;
  defaultTab: WorkspaceTab;
  icon: ReactNode;
}

const SCENARIO_CATALOG: { key: ScenarioKey; label: string; tag: string }[] = [
  { key: 'normal_market', label: 'Normal Market (Balanced Liquidity)', tag: 'BASELINE' },
  { key: 'high_volatility', label: 'High Volatility (Jump Diffusion)', tag: 'STRESS' },
  { key: 'poor_liquidity', label: 'Poor Liquidity / Thin Book', tag: 'THIN BOOK' },
  { key: 'high_adverse_selection', label: 'High Adverse-Selection Risk (Toxic Flow)', tag: 'TOXIC FLOW' },
  { key: 'low_adverse_selection', label: 'Low Adverse-Selection Risk (Passive Maker)', tag: 'MAKER IDEAL' },
  { key: 'small_order', label: 'Small Order (<1% Depth)', tag: 'LOW IMPACT' },
  { key: 'medium_order', label: 'Medium Order (~10% Depth)', tag: 'STANDARD' },
  { key: 'large_order', label: 'Large Institutional Block (5,000 Units)', tag: 'BLOCK ORDER' },
  { key: 'short_execution_horizon', label: 'Short Execution Horizon (20s High Urgency)', tag: 'URGENT' },
  { key: 'long_execution_horizon', label: 'Long Execution Horizon (180s Patient)', tag: 'PATIENT' },
];

const defaults: RunOptions = {
  scenario: 'normal_market',
  side: 'buy',
  order_size: 500,
  horizon_sec: 60,
  symbol: 'NVDA',
  record_trade: false,
  risk_aversion: 0.0001,
  risk_high_threshold: 0.65,
  risk_low_threshold: 0.35,
  urgency_high_threshold: 0.75,
  ac_num_slices: 12,
};

const STORAGE_TOKEN_KEY = 'fasttrade_session_token';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(Boolean(localStorage.getItem(STORAGE_TOKEN_KEY)));
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [activeInstrument, setActiveInstrument] = useState<string>('NVDA');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [liveMarket, setLiveMarket] = useState<LiveMarketSnapshot | null>(null);
  const [portfolioData, setPortfolioData] = useState<PortfolioAndBlotterResponse | null>(null);
  const [refreshingLive, setRefreshingLive] = useState<boolean>(false);

  const [options, setOptions] = useState<RunOptions>(defaults);
  const [status, setStatus] = useState('Connecting to FastTrade Live Engine…');
  const [running, setRunning] = useState(false);
  const [tcaModalOpen, setTcaModalOpen] = useState(false);
  const [showParamSandbox, setShowParamSandbox] = useState(true);
  const [accountToast, setAccountToast] = useState<string | null>(null);

  // Interactive Tick-by-Tick Replay state
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const totalTicks = snapshot?.execution?.trajectory.length ?? 0;

  function applyUserPreferencesToOptions(user: UserAccount) {
    const p = user.preferences;
    setOptions(prev => ({
      ...prev,
      scenario: p.default_scenario ?? prev.scenario,
      side: p.default_side ?? prev.side,
      order_size: p.default_order_size ?? prev.order_size,
      horizon_sec: p.default_horizon_sec ?? prev.horizon_sec,
      risk_aversion: p.risk_aversion ?? prev.risk_aversion,
      risk_high_threshold: p.risk_high_threshold ?? prev.risk_high_threshold,
      urgency_high_threshold: p.urgency_high_threshold ?? prev.urgency_high_threshold,
      ac_num_slices: p.ac_num_slices ?? prev.ac_num_slices,
    }));
  }

  function handleAuthenticated(
    auth: AuthResponse,
    meta?: { isNewRegistration?: boolean; isPasswordReset?: boolean },
  ) {
    localStorage.setItem(STORAGE_TOKEN_KEY, auth.token);
    setToken(auth.token);
    setCurrentUser(auth.user);
    applyUserPreferencesToOptions(auth.user);
    setActiveTab(auth.user.role === 'admin' ? 'governance' : 'overview');
    void refreshLiveMarketAndPortfolio(false, auth.user.email, auth.token);
    const emailNotif = auth.email_notification || auth.email_dispatched;
    if (meta?.isNewRegistration) {
      const statusText = emailNotif?.status === 'sent' ? 'delivered' : 'dispatched';
      setAccountToast(
        `Welcome to FastTrade, ${auth.user.full_name}! Welcome email ${statusText} to ${auth.user.email} · Your isolated $25M portfolio & blotter are active.`,
      );
    } else if (meta?.isPasswordReset) {
      setAccountToast(
        `Password updated & confirmed via email (${auth.user.email}). Signed into your isolated workspace.`,
      );
    }
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
    setAccountToast(null);
    setActiveTab('overview');
  }

  async function handleQuickRoleSwitch(targetRole: 'trader' | 'admin') {
    const auth = await demoLogin(targetRole);
    handleAuthenticated(auth);
  }

  async function refreshLiveMarketAndPortfolio(
    force = false,
    overrideEmail?: string | null,
    overrideToken?: string | null,
  ) {
    setRefreshingLive(true);
    try {
      const activeEmail = overrideEmail ?? currentUser?.email ?? 'trader@fasttrade.ai';
      const activeTok = overrideToken ?? token;
      const [mkt, port] = await Promise.all([
        getLiveMarketData(force),
        getPortfolioAndBlotter(force, activeEmail, activeTok),
      ]);
      setLiveMarket(mkt);
      setPortfolioData(port);
    } catch {
      // keep existing live cache on transient error
    } finally {
      setRefreshingLive(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setAuthChecking(false);
      return;
    }
    getCurrentUser(token)
      .then(res => {
        setCurrentUser(res.user);
        applyUserPreferencesToOptions(res.user);
        void refreshLiveMarketAndPortfolio(false, res.user.email, token);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_TOKEN_KEY);
        setToken(null);
        setCurrentUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, [token]);

  // Initial load + periodic 25s live Yahoo Finance & Portfolio Mark-to-Market refresh
  useEffect(() => {
    const controller = new AbortController();
    getDashboardSnapshot(controller.signal, false, activeInstrument)
      .then(data => {
        setSnapshot(data);
        setReplayIndex(null);
        setStatus('LIVE ENGINE ONLINE');
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setStatus(error instanceof Error ? error.message : 'Dashboard API unavailable');
        }
      });

    void refreshLiveMarketAndPortfolio(false);
    const interval = window.setInterval(() => {
      void refreshLiveMarketAndPortfolio(false);
    }, 25000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || totalTicks === 0) return;
    const timer = window.setInterval(() => {
      setReplayIndex(prev => {
        const next = prev === null ? 0 : prev + 1;
        if (next >= totalTicks - 1) {
          setIsPlaying(false);
          return null;
        }
        return next;
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [isPlaying, totalTicks]);

  async function run(customOpts?: RunOptions, bookToPortfolio = false) {
    const baseOpts = customOpts ?? options;
    const targetOpts: RunOptions = {
      ...baseOpts,
      symbol: baseOpts.symbol ?? activeInstrument,
      record_trade: bookToPortfolio,
      user_email: currentUser?.email ?? 'trader@fasttrade.ai',
    };
    setRunning(true);
    setIsPlaying(false);
    setStatus(
      bookToPortfolio
        ? `Executing & booking ${targetOpts.symbol} order to portfolio…`
        : `Simulating ${targetOpts.symbol} LOB & routing slices…`,
    );
    try {
      const nextSnap = await runDashboard(targetOpts);
      setSnapshot(nextSnap);
      setReplayIndex(null);
      setStatus('LIVE ENGINE ONLINE');
      if (bookToPortfolio) {
        const updatedPort = await getPortfolioAndBlotter(false, currentUser?.email, token);
        setPortfolioData(updatedPort);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Dashboard run failed');
    } finally {
      setRunning(false);
    }
  }

  function handleSelectInstrument(symbol: string, preset?: Partial<RunOptions>) {
    setActiveInstrument(symbol);
    const nextOpts: RunOptions = {
      ...options,
      ...(preset ?? {}),
      symbol,
    };
    setOptions(nextOpts);
    void run(nextOpts, false);
  }

  async function handleQuickBookTrade(
    symbol: string,
    side: Side,
    quantity: number,
    scenario: ScenarioKey,
  ) {
    setActiveInstrument(symbol);
    const res = await executePortfolioTrade({
      symbol,
      side,
      quantity,
      scenario,
      horizon_sec: options.horizon_sec,
      user_email: currentUser?.email || 'trader@fasttrade.ai',
    });
    setPortfolioData(res.portfolio);
    setSnapshot(res.snapshot);
  }

  // Compute Executive KPI Metrics
  const midPrice = snapshot?.market?.mid_price ?? 217.14;
  const targetQty = snapshot?.execution?.target_quantity ?? options.order_size;
  const notionalUsd = midPrice * targetQty;

  const perfResults = snapshot?.performance?.results ?? [];
  const sfPerf = perfResults.find(r => r.strategy === 'fasttrade') ?? perfResults.find(r => r.strategy === 'proposed');
  const twapPerf = perfResults.find(r => r.strategy === 'twap');
  const mktPerf = perfResults.find(r => r.strategy === 'market');

  const sfShortfallBps = sfPerf?.implementation_shortfall_bps ?? 0;
  const twapShortfallBps = twapPerf?.implementation_shortfall_bps ?? 0;
  const mktShortfallBps = mktPerf?.implementation_shortfall_bps ?? 0;

  const alphaVsTwapBps = twapShortfallBps - sfShortfallBps;
  const alphaVsTwapUsd = (alphaVsTwapBps / 10000) * notionalUsd;

  const toxProb = (snapshot?.risk?.adverse_selection_probability ?? 0) * 100;
  const latestValidForecast = [...(snapshot?.forecast?.points ?? [])].reverse().find(p => p.valid);

  if (authChecking) {
    return (
      <div className="auth-page-wrap">
        <div className="ai-loading-state">
          <div className="spinner" />
          <p>Restoring FastTrade Institutional Session…</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !token) {
    return (
      <>
        <nav className="genesis-topbar">
          <div className="genesis-topbar-inner">
            <div className="genesis-brand">
              <FastTradeLogo size={36} showSubtitle={true} />
            </div>
            <div className="genesis-nav-actions">
              <div className="status-pill" role="status">
                <span className={`status-dot ${status.includes('ONLINE') ? 'dot-online' : 'dot-busy'}`} />
                {status}
              </div>
            </div>
          </div>
        </nav>
        <GlobalMarketTickerBar
          liveMarket={liveMarket}
          activeSymbol={activeInstrument}
          onSelectSymbol={handleSelectInstrument}
          onRefreshLive={() => void refreshLiveMarketAndPortfolio(true)}
          refreshingLive={refreshingLive}
        />
        <AuthScreen onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  const tradesCount = portfolioData?.summary?.total_trades_count ?? 7;
  const openPosCount = portfolioData?.summary?.open_positions_count ?? 6;

  // 4 Primary Apple-Style Navigation Pillars (Crisp Single-Line Labels)
  const NAV_PILLARS: NavPillarItem[] = [
    {
      id: 'markets',
      label: 'Markets',
      subtitle: 'Live Pulse & Screener',
      defaultTab: 'overview',
      icon: <GlobeIcon size={15} />,
    },
    {
      id: 'execution',
      label: 'Order Routing',
      subtitle: 'EMS, 4-Venue SOR & CaR',
      defaultTab: 'ems',
      icon: <ActivityIcon size={15} />,
    },
    {
      id: 'portfolio',
      label: 'Portfolio',
      subtitle: 'Holdings & Blotter',
      defaultTab: 'portfolio',
      icon: <BriefcaseIcon size={15} />,
    },
    {
      id: 'quant_gov',
      label: 'AI & Quant Lab',
      subtitle: 'Signals, Agent & CRO',
      defaultTab: 'signals',
      icon: <SparklesIcon size={15} />,
    },
  ];

  // Contextual Sub-Tabs across the 4 Pillars
  const SUB_TABS: SubTabItem[] = [
    // Pillar 1: Markets
    {
      id: 'overview',
      pillar: 'markets',
      label: 'Market Pulse & VWAP',
      shortDesc: '5-minute live Yahoo Finance price, session VWAP & OFI telemetry',
      badge: 'LIVE',
      icon: <TrendingUpIcon size={14} />,
    },
    {
      id: 'screener',
      pillar: 'markets',
      label: 'Liquidity Screener',
      shortDesc: '8-asset institutional universe with live spreads, OFI & 1-click trading',
      badge: '8 ASSETS',
      icon: <BarChartIcon size={14} />,
    },
    // Pillar 2: Order Routing
    {
      id: 'ems',
      pillar: 'execution',
      label: 'Order Ticket & L2 Book',
      shortDesc: 'Parent order ticket, quant sliders, tick playback & 5-level LOB depth',
      badge: activeInstrument,
      icon: <ActivityIcon size={14} />,
    },
    {
      id: 'sor_tca',
      pillar: 'execution',
      label: '4-Venue SOR & TCA',
      shortDesc: 'NYSE / NASDAQ / EDGX / IEX dark-lit router & 6-strategy shortfall benchmark',
      badge: '4 VENUES',
      icon: <LayersIcon size={14} />,
    },
    {
      id: 'stress',
      pillar: 'execution',
      label: 'Monte Carlo CaR',
      shortDesc: '250-path jump-diffusion Cost-at-Risk (95% / 99%) & auto-calibration',
      badge: '250 PATHS',
      icon: <SlidersIcon size={14} />,
    },
    // Pillar 3: Portfolio
    {
      id: 'portfolio',
      pillar: 'portfolio',
      label: 'Open Positions & MTM',
      shortDesc: '$25M desk NAV, live mark-to-market holdings, unrealized/realized P&L',
      badge: `${openPosCount} POS`,
      icon: <BriefcaseIcon size={14} />,
    },
    {
      id: 'blotter',
      pillar: 'portfolio',
      label: 'Execution Blotter',
      shortDesc: 'Immutable ledger of filled parent orders, venue splits & TCA alpha saved',
      badge: `${tradesCount} FILLS`,
      icon: <FileTextIcon size={14} />,
    },
    // Pillar 4: AI & Quant Lab
    {
      id: 'signals',
      pillar: 'quant_gov',
      label: 'L2 & ML Signals',
      shortDesc: 'Adverse-selection toxicity classifier, 5-tick GRU forecast & LOB features',
      badge: 'ML + GRU',
      icon: <CpuIcon size={14} />,
    },
    {
      id: 'copilot',
      pillar: 'quant_gov',
      label: '5-Stage AI & Coding Lab',
      shortDesc: '5-stage Nemotron-3 workflow, 3-cycle test-and-iterate coding agent & Tavily web search',
      badge: 'NEMOTRON',
      icon: <SparklesIcon size={14} />,
    },
    {
      id: 'governance',
      pillar: 'quant_gov',
      label: 'CRO Governance',
      shortDesc: 'Global risk ceilings, trader seat directory & compliance dispatch',
      badge: currentUser.role === 'admin' ? 'CRO' : 'POLICY',
      icon: <ShieldIcon size={14} />,
    },
  ];

  const activeSubTabMeta = SUB_TABS.find(t => t.id === activeTab) ?? SUB_TABS[0];
  const activePillarId: NavPillarId = activeSubTabMeta.pillar;
  const visibleSubTabs = SUB_TABS.filter(t => t.pillar === activePillarId);

  const availableInstruments = liveMarket?.instruments?.length
    ? liveMarket.instruments
    : [
        { symbol: 'NVDA', price: 217.14 },
        { symbol: 'BTC-USD', price: 80834.55 },
        { symbol: 'SPY', price: 770.83 },
        { symbol: 'AAPL', price: 344.67 },
        { symbol: 'MSFT', price: 528.18 },
        { symbol: 'ETH-USD', price: 2344.22 },
        { symbol: 'ES-FUT', price: 7761.25 },
        { symbol: 'NQ-FUT', price: 29813.25 },
      ];

  return (
    <>
      {/* Tier 1: Apple-Inspired Frosted Glass Top Navigation Bar */}
      <nav className="genesis-topbar">
        <div className="genesis-topbar-inner">
          <div className="genesis-brand">
            <button
              type="button"
              className="ft-logo-btn"
              onClick={() => setActiveTab('overview')}
              title="FastTrade Institutional EMS Home"
            >
              <FastTradeLogo size={32} showSubtitle={false} />
            </button>
          </div>

          {/* Center: Spacious 4-Pillar Apple Segmented Pill Bar */}
          <div className="ft-primary-menu hide-mobile" role="menubar" aria-label="Primary Institutional Menu">
            {NAV_PILLARS.map(pillar => {
              const isActivePillar = activePillarId === pillar.id;
              return (
                <button
                  key={pillar.id}
                  type="button"
                  role="menuitem"
                  className={`ft-menu-pillar-btn ${isActivePillar ? 'ft-menu-pillar-active' : ''}`}
                  onClick={() => setActiveTab(pillar.defaultTab)}
                  title={pillar.subtitle}
                >
                  <span className="ft-pillar-icon">{pillar.icon}</span>
                  <span className="ft-pillar-title">{pillar.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Spacious Single-Line Desk Controls */}
          <div className="genesis-nav-actions">
            <label className="ft-topbar-asset-picker hide-mobile" title="Switch Active Trading Instrument">
              <span className={`status-dot ${status.includes('ONLINE') ? 'dot-online' : 'dot-busy'}`} />
              <select
                value={activeInstrument}
                onChange={e => handleSelectInstrument(e.target.value)}
                aria-label="Active trading instrument"
              >
                {availableInstruments.map(inst => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol} · ${inst.price.toLocaleString()}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn-outline-sm hide-mobile"
              title="Switch Institutional Desk Role"
              onClick={() => void handleQuickRoleSwitch(currentUser.role === 'admin' ? 'trader' : 'admin')}
            >
              {currentUser.role === 'admin' ? 'Role: Trader' : 'Role: CRO'}
            </button>

            <button
              type="button"
              className="btn-outline-sm user-profile-trigger"
              onClick={() => setProfileModalOpen(true)}
            >
              <UserIcon size={14} />
              <span className="hide-mobile">{currentUser.full_name}</span>
              <span className="role-chip-mini">{currentUser.role.toUpperCase()}</span>
            </button>

            <button
              type="button"
              className="btn-outline-sm hide-mobile"
              aria-label="Sign out to login screen"
              title="Sign Out"
              onClick={handleLogout}
            >
              <LogOutIcon size={14} />
            </button>

            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              className="btn-outline-sm ft-mobile-menu-trigger"
              aria-label="Toggle Navigation Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <CloseIcon size={16} /> : <MenuIcon size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Responsive Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="ft-mobile-drawer">
            <div className="ft-mobile-drawer-grid">
              {NAV_PILLARS.map(pillar => (
                <div key={pillar.id} className="ft-mobile-pillar-group">
                  <div className="ft-mobile-pillar-header">
                    {pillar.icon} <strong>{pillar.label}</strong>
                  </div>
                  {SUB_TABS.filter(t => t.pillar === pillar.id).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`ft-mobile-sub-btn ${activeTab === sub.id ? 'ft-mobile-sub-active' : ''}`}
                      onClick={() => {
                        setActiveTab(sub.id);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <span>{sub.label}</span>
                      {sub.badge && <span className="workspace-tab-badge">{sub.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="ft-mobile-drawer-footer">
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => {
                  void handleQuickRoleSwitch(currentUser.role === 'admin' ? 'trader' : 'admin');
                  setMobileMenuOpen(false);
                }}
              >
                {currentUser.role === 'admin' ? 'Switch to Quant Trader' : 'Switch to CRO Officer'}
              </button>
              <button type="button" className="btn-outline-sm" onClick={handleLogout}>
                <LogOutIcon size={14} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Tier 2: Spacious 2-Row Global Market Indices Grid (Important Data Only) */}
      <GlobalMarketTickerBar
        liveMarket={liveMarket}
        activeSymbol={activeInstrument}
        onSelectSymbol={handleSelectInstrument}
        onRefreshLive={() => void refreshLiveMarketAndPortfolio(true)}
        refreshingLive={refreshingLive}
      />

      {/* Tier 3: Unified Apple Studio Sub-Navigation & Quick Action Bar (Eliminates Vertical Scroll Bloat) */}
      <div className="ft-subnav-bar" role="navigation" aria-label="Module Sub-Navigation">
        <div className="ft-subnav-inner">
          {/* Left: Contextual Sub-Tabs for Active Pillar */}
          <div className="ft-subtabs-group" role="tablist">
            {visibleSubTabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`workspace-tab-btn ${activeTab === tab.id ? 'workspace-tab-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.shortDesc}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && <span className="workspace-tab-badge">{tab.badge}</span>}
              </button>
            ))}
          </div>

          {/* Right: Streamlined Quick Execution Actions */}
          <div className="ft-subnav-actions">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => void run(undefined, false)}
              disabled={running}
            >
              <PlayIcon size={13} /> {running ? 'Simulating…' : 'Simulate'}
            </button>
            <button
              type="button"
              className="btn-run-sim"
              onClick={() => void run(undefined, true)}
              disabled={running}
              title="Execute parent order and book transaction into Portfolio"
            >
              <CheckCircleIcon size={13} /> Book Trade
            </button>
            <button
              type="button"
              className="btn-outline-sm hide-mobile"
              onClick={() => setActiveTab('copilot')}
              title="Open 5-Stage Autonomous Agent, Coding Lab & Tavily Web Intelligence"
            >
              <SparklesIcon size={13} /> 5-Stage AI
            </button>
            <button
              type="button"
              className="btn-nvidia hide-mobile"
              onClick={() => setTcaModalOpen(true)}
              disabled={!snapshot}
            >
              <FileTextIcon size={13} /> TCA Memo
            </button>
          </div>
        </div>
      </div>

      <main className="terminal-shell">
        {accountToast && (
          <div className="profile-success-banner" style={{ marginBottom: '0.85rem', justifyContent: 'space-between' }} role="status">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircleIcon size={16} />
              <span>{accountToast}</span>
            </span>
            <button
              type="button"
              className="btn-outline-sm"
              style={{ padding: '0.2rem 0.65rem', fontSize: '0.72rem' }}
              onClick={() => setAccountToast(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        {activeTab === 'governance' ? (
          <AdminPanel token={token} snapshot={snapshot} />
        ) : activeTab === 'portfolio' || activeTab === 'blotter' ? (
          <PortfolioBlotterTab
            portfolioData={portfolioData}
            liveMarket={liveMarket}
            userEmail={currentUser.email}
            activeSubTab={activeTab === 'blotter' ? 'blotter' : 'positions'}
            onPortfolioUpdated={(nextPort, nextSnap) => {
              setPortfolioData(nextPort);
              if (nextSnap) setSnapshot(nextSnap);
            }}
            onRefreshPortfolio={() => void refreshLiveMarketAndPortfolio(true)}
            refreshing={refreshingLive}
          />
        ) : (
          <>
            {/* Compact 5-Card Apple KPI Ribbon (Important Metrics Only) */}
            {snapshot && (
              <section className="kpi-ribbon">
                <div className="kpi-card">
                  <span className="kpi-label">FASTTRADE SHORTFALL</span>
                  <strong className="kpi-value mono-val bid-text">{sfShortfallBps.toFixed(2)} bps</strong>
                  <span className="kpi-sub">
                    TWAP <strong>{twapShortfallBps.toFixed(2)}</strong> · Mkt <strong>{mktShortfallBps.toFixed(2)}</strong>
                  </span>
                </div>

                <div className="kpi-card kpi-highlight">
                  <span className="kpi-label">ALPHA SAVED VS TWAP</span>
                  <strong className={`kpi-value mono-val ${alphaVsTwapUsd >= 0 ? 'bid-text' : 'ask-text'}`}>
                    {alphaVsTwapUsd >= 0 ? '+' : ''}$
                    {alphaVsTwapUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                  <span className="kpi-sub">
                    {alphaVsTwapBps >= 0 ? '+' : ''}
                    {alphaVsTwapBps.toFixed(2)} bps on ${notionalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">TOXICITY PROBABILITY</span>
                  <strong
                    className="kpi-value mono-val"
                    style={{ color: toxProb >= 65 ? '#FF3B30' : toxProb <= 35 ? '#00A854' : '#FF9500' }}
                  >
                    {toxProb.toFixed(1)}%
                  </strong>
                  <span className="kpi-sub kpi-icon-inline">
                    {toxProb >= (options.risk_high_threshold ?? 0.65) * 100 ? (
                      <span className="ask-text">
                        <AlertTriangleIcon size={12} /> Withdraw Maker
                      </span>
                    ) : (
                      <span className="bid-text">
                        <CheckCircleIcon size={12} /> Passive Safe
                      </span>
                    )}
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">GRU 5-TICK FORECAST</span>
                  <strong className="kpi-value mono-val" style={{ color: '#0071E3' }}>
                    {latestValidForecast && latestValidForecast.expected_move_bps !== null
                      ? `${latestValidForecast.expected_move_bps >= 0 ? '+' : ''}${latestValidForecast.expected_move_bps.toFixed(2)} bps`
                      : 'Trained GRU'}
                  </strong>
                  <span className="kpi-sub">
                    Signal: <strong>{latestValidForecast?.direction ?? 'NEUTRAL'}</strong>
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">ACTIVE INSTRUMENT</span>
                  <strong className="kpi-value mono-val" style={{ color: '#1D1D1F' }}>
                    {activeInstrument} · ${midPrice.toLocaleString()}
                  </strong>
                  <span className="kpi-sub">
                    {snapshot.regime_info?.badge_label ?? 'NORMAL'} ·{' '}
                    <strong>{snapshot.regime_info?.spread_bps.toFixed(1) ?? '4.8'} bps</strong>
                  </span>
                </div>
              </section>
            )}

            {/* PILLAR 1: LIVE MARKET OVERVIEW OR MULTI-ASSET LIQUIDITY SCREENER */}
            {(activeTab === 'overview' || activeTab === 'screener') && (
              <MarketOverviewHub
                snapshot={snapshot}
                liveMarket={liveMarket}
                options={options}
                activeSymbol={activeInstrument}
                viewMode={activeTab === 'screener' ? 'screener' : 'overview'}
                onSelectInstrument={(sym, preset) => handleSelectInstrument(sym, preset)}
                onQuickBookTrade={handleQuickBookTrade}
                onNavigateTab={tab => setActiveTab(tab)}
                onRefreshLive={() => void refreshLiveMarketAndPortfolio(true)}
                refreshingLive={refreshingLive}
              />
            )}

            {/* PILLAR 2A: EMS EXECUTION TICKET, TICK REPLAY & L2 ORDER BOOK */}
            {activeTab === 'ems' && (
              <>
                <section className="control-deck">
                  <form
                    className="run-controls"
                    onSubmit={event => {
                      event.preventDefault();
                      void run(undefined, false);
                    }}
                  >
                    <label className="control-field">
                      <span>ACTIVE INSTRUMENT (LIVE)</span>
                      <select
                        value={activeInstrument}
                        onChange={e => handleSelectInstrument(e.target.value)}
                      >
                        {availableInstruments.map(inst => (
                          <option key={inst.symbol} value={inst.symbol}>
                            {inst.symbol} (${inst.price.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="control-field scenario-field">
                      <span>MARKET REGIME SCENARIO (10 CALIBRATED REGIMES)</span>
                      <select
                        value={options.scenario}
                        onChange={event =>
                          setOptions({ ...options, scenario: event.target.value as RunOptions['scenario'] })
                        }
                      >
                        {SCENARIO_CATALOG.map(s => (
                          <option key={s.key} value={s.key}>
                            [{s.tag}] {s.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="control-field">
                      <span>ORDER SIDE</span>
                      <select
                        value={options.side}
                        onChange={event => setOptions({ ...options, side: event.target.value as RunOptions['side'] })}
                      >
                        <option value="buy">BUY (Institutional Accumulate)</option>
                        <option value="sell">SELL (Institutional Liquidate)</option>
                      </select>
                    </label>

                    <label className="control-field">
                      <span>PARENT ORDER SIZE (UNITS)</span>
                      <input
                        type="number"
                        min="1"
                        max="100000"
                        step="1"
                        required
                        value={options.order_size}
                        onChange={event => setOptions({ ...options, order_size: Number(event.target.value) })}
                      />
                    </label>

                    <label className="control-field">
                      <span>HORIZON (SEC)</span>
                      <input
                        type="number"
                        min="10"
                        max="300"
                        step="1"
                        required
                        value={options.horizon_sec}
                        onChange={event => setOptions({ ...options, horizon_sec: Number(event.target.value) })}
                      />
                    </label>

                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => setShowParamSandbox(!showParamSandbox)}
                    >
                      <SlidersIcon size={14} /> {showParamSandbox ? 'Hide Sliders' : 'Quant Sliders'}
                    </button>

                    <button type="submit" className="btn-outline-sm" disabled={running}>
                      <PlayIcon size={14} /> {running ? 'Simulating…' : 'Simulate Replay'}
                    </button>

                    <button
                      type="button"
                      className="btn-run-sim"
                      disabled={running}
                      onClick={() => void run(undefined, true)}
                    >
                      <CheckCircleIcon size={14} /> {running ? 'Booking…' : 'Execute & Book Order'}
                    </button>
                  </form>

                  {showParamSandbox && (
                    <div className="param-sandbox">
                      <div className="param-sandbox-header">
                        <span className="toolbar-label">
                          <SlidersIcon size={12} /> QUANTITATIVE PARAMETER TUNING SANDBOX (ALMGREN–CHRISS &amp; SOR DECISION GATES)
                        </span>
                        <button
                          type="button"
                          className="btn-link-trace"
                          onClick={() =>
                            setOptions({
                              ...options,
                              risk_aversion: 0.0001,
                              risk_high_threshold: 0.65,
                              urgency_high_threshold: 0.75,
                              ac_num_slices: 12,
                            })
                          }
                        >
                          <RefreshIcon size={12} /> Reset Institutional Defaults
                        </button>
                      </div>

                      <div className="param-sliders-grid">
                        <label className="slider-box">
                          <div className="slider-top">
                            <span>AC Risk Aversion (λ)</span>
                            <strong className="mono-val">{(options.risk_aversion ?? 0.0001).toExponential(1)}</strong>
                          </div>
                          <input
                            type="range"
                            min={0.00001}
                            max={0.001}
                            step={0.00001}
                            value={options.risk_aversion ?? 0.0001}
                            onChange={e => setOptions({ ...options, risk_aversion: Number(e.target.value) })}
                          />
                          <small>Higher λ front-loads execution to reduce price variance</small>
                        </label>

                        <label className="slider-box">
                          <div className="slider-top">
                            <span>Toxicity Withdrawal Gate</span>
                            <strong className="mono-val" style={{ color: '#EF4444' }}>
                              {((options.risk_high_threshold ?? 0.65) * 100).toFixed(0)}%
                            </strong>
                          </div>
                          <input
                            type="range"
                            min={0.45}
                            max={0.9}
                            step={0.05}
                            value={options.risk_high_threshold ?? 0.65}
                            onChange={e => setOptions({ ...options, risk_high_threshold: Number(e.target.value) })}
                          />
                          <small>Cancel resting maker order when ML toxicity exceeds gate</small>
                        </label>

                        <label className="slider-box">
                          <div className="slider-top">
                            <span>Deadline Urgency Override</span>
                            <strong className="mono-val" style={{ color: '#F59E0B' }}>
                              {((options.urgency_high_threshold ?? 0.75) * 100).toFixed(0)}%
                            </strong>
                          </div>
                          <input
                            type="range"
                            min={0.55}
                            max={0.95}
                            step={0.05}
                            value={options.urgency_high_threshold ?? 0.75}
                            onChange={e => setOptions({ ...options, urgency_high_threshold: Number(e.target.value) })}
                          />
                          <small>Force aggressive spread-crossing when urgency crosses gate</small>
                        </label>

                        <label className="slider-box">
                          <div className="slider-top">
                            <span>Almgren–Chriss Slices (N)</span>
                            <strong className="mono-val" style={{ color: '#6366F1' }}>
                              {options.ac_num_slices ?? 12} slices
                            </strong>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={24}
                            step={2}
                            value={options.ac_num_slices ?? 12}
                            onChange={e => setOptions({ ...options, ac_num_slices: Number(e.target.value) })}
                          />
                          <small>Discrete trajectory child-order partitions over horizon T</small>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="replay-toolbar">
                    <div className="preset-regimes">
                      <span className="toolbar-label">QUICK REGIMES:</span>
                      {(
                        [
                          'normal_market',
                          'high_adverse_selection',
                          'high_volatility',
                          'poor_liquidity',
                          'large_order',
                        ] as ScenarioKey[]
                      ).map(key => (
                        <button
                          key={key}
                          type="button"
                          className={`preset-chip ${options.scenario === key ? 'preset-active' : ''}`}
                          disabled={running}
                          onClick={() => {
                            const nextOpts: RunOptions = {
                              ...options,
                              scenario: key,
                              order_size: key === 'large_order' ? 5000 : options.order_size,
                            };
                            setOptions(nextOpts);
                            void run(nextOpts, false);
                          }}
                        >
                          {key.replaceAll('_', ' ')}
                        </button>
                      ))}
                    </div>

                    {totalTicks > 0 && (
                      <div className="scrubber-controls">
                        <span className="toolbar-label">TICK PLAYBACK:</span>
                        <button
                          type="button"
                          className="btn-outline-sm"
                          onClick={() => {
                            if (isPlaying) {
                              setIsPlaying(false);
                            } else {
                              if (replayIndex === null || replayIndex >= totalTicks - 1) setReplayIndex(0);
                              setIsPlaying(true);
                            }
                          }}
                        >
                          {isPlaying ? (
                            <>
                              <PauseIcon size={13} /> Pause
                            </>
                          ) : (
                            <>
                              <PlayIcon size={13} /> Play Tick-by-Tick
                            </>
                          )}
                        </button>
                        <input
                          type="range"
                          aria-label="Replay tick scrubber"
                          min={0}
                          max={Math.max(0, totalTicks - 1)}
                          value={replayIndex ?? Math.max(0, totalTicks - 1)}
                          onChange={e => {
                            setIsPlaying(false);
                            const val = Number(e.target.value);
                            setReplayIndex(val >= totalTicks - 1 ? null : val);
                          }}
                          className="tick-slider"
                        />
                        <span className="mono-val tick-counter">
                          Tick {(replayIndex ?? totalTicks - 1) + 1}/{totalTicks}
                        </span>
                        {replayIndex !== null && (
                          <button
                            type="button"
                            className="btn-outline-sm"
                            onClick={() => {
                              setIsPlaying(false);
                              setReplayIndex(null);
                            }}
                          >
                            Show Full Run
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid">
                  <OrderBook market={snapshot?.market ?? null} />
                  <Execution execution={snapshot?.execution ?? null} activeTickIndex={replayIndex} />
                  <ACSchedule schedule={snapshot?.ac_schedule ?? null} />
                </div>
              </>
            )}

            {/* PILLAR 2B: MULTI-VENUE SOR & 6-STRATEGY TCA BENCHMARK */}
            {activeTab === 'sor_tca' && (
              <div className="grid">
                <VenueRouterCard routing={snapshot?.venue_routing} />
                <Performance
                  performance={snapshot?.performance ?? null}
                  midPrice={midPrice}
                  targetQuantity={targetQty}
                  onOpenTCA={() => setTcaModalOpen(true)}
                />
                <Execution execution={snapshot?.execution ?? null} activeTickIndex={replayIndex} />
              </div>
            )}

            {/* PILLAR 2C: PRE-TRADE MONTE CARLO COST-AT-RISK (CaR) & TRAJECTORY */}
            {activeTab === 'stress' && (
              <>
                <PreTradeStressCard
                  options={options}
                  onApplyOptimal={nextOpts => {
                    setOptions(nextOpts);
                    void run(nextOpts, false);
                  }}
                />
                <div className="grid">
                  <ACSchedule schedule={snapshot?.ac_schedule ?? null} />
                  <Execution execution={snapshot?.execution ?? null} activeTickIndex={replayIndex} />
                </div>
              </>
            )}

            {/* PILLAR 4A: QUANT SIGNALS, ML ADVERSE SELECTION & L2 MICROSTRUCTURE */}
            {activeTab === 'signals' && (
              <div className="grid">
                <Risk risk={snapshot?.risk ?? null} activeTickIndex={replayIndex} />
                <Forecast forecast={snapshot?.forecast ?? null} activeTickIndex={replayIndex} />
                <MarketFeatures features={snapshot?.features ?? null} />
                <OrderBook market={snapshot?.market ?? null} />
              </div>
            )}

            {/* PILLAR 4B: AI QUANT COPILOT & TCA COMMITTEE AUDIT (keeps TCA modal mounted across tabs) */}
            <div style={{ display: activeTab === 'copilot' || tcaModalOpen ? 'block' : 'none' }}>
              <NebiusAIPanel
                snapshot={snapshot}
                tcaModalOpen={tcaModalOpen}
                setTcaModalOpen={setTcaModalOpen}
                userEmail={currentUser.email}
                token={token}
                onApplyParameters={params => {
                  const nextOpts: RunOptions = {
                    ...options,
                    risk_aversion: params.risk_aversion,
                    risk_high_threshold: params.risk_high_threshold,
                    urgency_high_threshold: params.urgency_high_threshold,
                    ac_num_slices: params.ac_num_slices,
                  };
                  setOptions(nextOpts);
                  void run(nextOpts, false);
                }}
                onNavigateBlotter={() => {
                  void refreshLiveMarketAndPortfolio(true);
                  setActiveTab('blotter');
                }}
              />
            </div>
          </>
        )}
      </main>

      {profileModalOpen && (
        <ProfileModal
          user={currentUser}
          token={token}
          onClose={() => setProfileModalOpen(false)}
          onProfileUpdated={(updatedUser, applyToTerminal) => {
            setCurrentUser(updatedUser);
            if (applyToTerminal) {
              applyUserPreferencesToOptions(updatedUser);
            }
          }}
        />
      )}
    </>
  );
}
