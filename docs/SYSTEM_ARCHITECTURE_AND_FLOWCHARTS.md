# FastTrade — System Architecture, Dataflow & Engineering Flowcharts

**Author & Lead Architect:** Ritesh Kochar ([`@ensuredesign`](https://github.com/ensuredesign) · `ensure01@gmail.com`)  
**Live Terminal:** [https://fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app) · **2-Min Demo Video:** [https://youtu.be/I9uMToKesDI](https://youtu.be/I9uMToKesDI)

---

## 1. Full-Stack Production Technical Stack

<p align="center">
  <img src="../public/fasttradeapp/technical-stack.png" alt="FastTrade Full-Stack Production Architecture" width="100%" />
</p>

FastTrade is architected as a modular, low-latency, full-stack institutional Execution Management System (EMS) divided into six cleanly decoupled operational domains:

| Architectural Plane | Core Technologies & Modules | Primary Responsibility |
| :--- | :--- | :--- |
| **1. Presentation & Interactive Terminal** | React 19, TypeScript 5.7, Vite 6, Plotly.js (`frontend/src/`) | 2-tier institutional navigation (4 primary pillars, 10 contextual workspaces), live L2 depth ladders, tick-by-tick replay scrubber, and interactive risk sliders. |
| **2. API Gateway & Quantitative Core** | Python 3.12+, FastAPI, Pydantic v2, NumPy, SciPy, Pandas, XGBoost, PyTorch (`api/`, `execution/`, `features/`, `models/`) | OWASP-hardened REST API, Stoikov/CKS microstructure extraction, Almgren–Chriss optimal trajectories, 4-venue SOR, and 250/500-path Monte Carlo CaR engine. |
| **3. Multi-Tier AI Inference** | Nebius Token Factory (`api.tokenfactory.nebius.com/v1`), NVIDIA Nemotron-3 `Nano 30B`, `Super 120B`, `Ultra 550B` (`services/nebius_ai.py`) | Complexity-routed tactical briefs, interactive quant copilot, policy code synthesis, and Investment Committee Post-Trade TCA memos. |
| **4. Isolated Cloud Sandboxes** | Nebius Sandboxes Beta (`contree-sdk==0.3.6`), `python:3.12-slim` micro-VMs (`services/nebius_sandbox_service.py`) | Parallel copy-on-write cloud VM branching (`v1 -> v2 -> v3`) for AST-checked Python strategy unit testing and immutable `promoted_image_uuid` promotion. |
| **5. Live Market Data & Catalyst Search** | Yahoo Finance v8 Live API, Coinbase Exchange L2 Book, Tavily Financial Search & Extract (`services/market_data_service.py`, `services/tavily_service.py`) | Concurrent cross-asset intraday quotes, cumulative session VWAP, real-time L2 depth ladders, and live breaking financial news toxicity reconnaissance. |
| **6. Persistence, Governance & Observability** | SQLite + Supabase PostgreSQL Mirror, LangSmith (`smith.langchain.com`), Resend, Vercel, Pytest (`services/auth_service.py`, `services/portfolio_service.py`, `services/langsmith_service.py`) | Per-user `$25.0M` MTM portfolio ledger, RBAC (`Trader` / `CRO`), hierarchical LLM/sandbox run-tree tracing with public audit URLs, and email memo dispatch. |

---

## 2. Layered System Architecture Flowchart

```mermaid
flowchart TB
    subgraph Client["Presentation Tier — React 19 + TypeScript 5.7 + Plotly.js"]
        UI_MKT["Markets & Liquidity Screener"]
        UI_SOR["Order Ticket, 5-Level L2 Book & 4-Venue SOR"]
        UI_PF["$25M MTM Portfolio & Execution Blotter"]
        UI_AI["5-Stage Autonomous Agent, Coding Lab & CRO Governance"]
    end

    subgraph Gateway["API & Security Layer — FastAPI + OWASP Middleware"]
        AUTH_MW["PBKDF2-HMAC-SHA256 Auth + Signed HMAC Bearer Sessions"]
        DASH_RT["/api/v1/dashboard · /market/live · /portfolio"]
        AI_RT["/api/v1/ai (Workflow · Coding Agent · Sandbox · Tavily · Memory)"]
        ADM_RT["/api/v1/admin (CRO Guardrails · Seat RBAC · Audit Dispatch)"]
    end

    subgraph DataPlane["Live Market Data & Microstructure Feature Plane"]
        YF["Yahoo Finance v8 API (8 Global Indices + Intraday 5m VWAP)"]
        CB["Coinbase Exchange L2 Book (Real-Time Multi-Level Depth)"]
        TAV["Tavily Financial Search & URL Extractor"]
        FEAT["Feature Pipeline (Stoikov Micro-Price · CKS OFI · Realized Vol)"]
        REG["Market Regime Classifier (10 Calibrated Regimes)"]
    end

    subgraph QuantPlane["Quantitative ML, Optimal Control & Multi-Venue SOR"]
        XGB["Calibrated XGBoost Classifier (28-Feature Post-Fill Toxicity)"]
        GRU["PyTorch Sequence GRU (20x14 Window -> 5-Tick Return)"]
        AC["Almgren-Chriss Optimizer (Closed-Form Hyperbolic Schedule)"]
        MC["Monte Carlo Stress Engine (250/500-Path Jump-Diffusion CaR)"]
        DSE["Dynamic Strategy Engine (Passive Maker / Taker Sweep / Hold)"]
        VR["4-Venue Router (NYSE · NASDAQ · CBOE EDGX · IEX Speed-Bump)"]
        BT["6-Strategy Identical-Seed Replay Backtester"]
    end

    subgraph AgentPlane["Multi-Tier Agentic Orchestration & Cloud Execution"]
        N30["NVIDIA Nemotron-3 Nano 30B (A3B MoE — Fast Recon)"]
        N120["NVIDIA Nemotron-3 Super 120B (A12B MoE — Coding & Copilot)"]
        N550["NVIDIA Nemotron-3 Ultra 550B (A55B MoE — CRO TCA Audit)"]
        VM["Nebius ConTree Sandboxes Beta (Isolated python:3.12-slim VMs)"]
        LS["LangSmith Run-Tree Tracer + Public Shareable Audit Links"]
    end

    subgraph StoragePlane["Transactional Persistence & External Dispatch"]
        DB[("SQLite + Supabase PostgreSQL (8 Normalized Tables)")]
        RES["Resend Transactional Committee Email Dispatch"]
    end

    Client --> AUTH_MW
    AUTH_MW --> DASH_RT & AI_RT & ADM_RT
    YF & CB --> FEAT --> REG
    DASH_RT --> FEAT
    FEAT --> XGB & GRU & AC & MC
    REG & XGB & GRU & AC --> DSE --> VR & BT
    BT --> DB
    AI_RT --> TAV & N30 & N120 & N550 & VM & LS
    AI_RT --> DB
    ADM_RT --> DB & RES
```

---

## 3. End-to-End 9-Step Institutional Execution Workflow

<p align="center">
  <img src="../public/fasttradeapp/end-to-end-workflow.png" alt="End-to-End 9-Step FastTrade Workflow" width="100%" />
</p>

```mermaid
flowchart LR
    S1["1. Role Sign-In (Trader / CRO)"] --> S2["2. Monitor Live Markets & VWAP"]
    S2 --> S3["3. Screen 8-Asset Liquidity & OFI"]
    S3 --> S4["4. Configure Parent Block Order"]
    S4 --> S5["5. 5-Stage AI & Quant Optimization"]
    S5 --> S6["6. Route Across 4 Venues (NYSE/NASDAQ/EDGX/IEX)"]
    S6 --> S7["7. Inspect 6-Strategy TCA & Toxicity"]
    S7 --> S8["8. Commit Fill to $25M MTM Blotter"]
    S8 --> S9["9. Export Ultra 550B CRO Memo & LangSmith Trace"]
```

---

## 4. Real-Time L2 Feature Extraction & Dynamic SOR Decision Tree

Every child-slice decision separates **adverse-selection protection**, **short-horizon directional drift**, and **Almgren–Chriss completion urgency** into deterministic, auditable gates:

```mermaid
flowchart TD
    SNAP["Incoming MarketSnapshot (5-Level Bid/Ask Ladder + Recent Trades)"] --> VAL["MarketDataValidator & Boundary Invariant Check"]
    VAL --> MICRO["Compute Stoikov Micro-Price, Multi-Level Imbalance & CKS OFI"]
    MICRO --> HIST["Update 20-Tick Canonical Feature Ring Buffer (20 x 14)"]

    MICRO --> TOX["XGBoost Toxicity Classifier: P(tox) over 10-Tick Horizon"]
    HIST --> DIR["PyTorch GRU Forecaster: Expected 5-Tick Move (bps)"]
    SNAP --> URG["Almgren-Chriss Inventory Schedule: sinh(kappa(T-t)) / sinh(kappa T)"]

    TOX & DIR & URG --> GATE_CRO{"CRO Global Guardrail Check: Size <= Max & Tox <= Ceiling?"}
    GATE_CRO -- "Violated" --> BLOCK["Reject / Throttle & Log CRO Governance Event"]
    GATE_CRO -- "Passed" --> GATE_URG{"Completion Urgency >= Urgency Override Gate (e.g. 75%)?"}

    GATE_URG -- "Yes (Deadline Near)" --> TAKER["AGGRESSIVE TAKER SWEEP: Cross Spread on Lowest-Fee Lit Venues (NASDAQ / NYSE)"]
    GATE_URG -- "No" --> GATE_TOX{"Post-Fill Toxicity P(tox) >= Withdrawal Gate (e.g. 65%)?"}

    GATE_TOX -- "Yes (Toxic Flow Detected)" --> DARK["WITHDRAW LIT QUOTES / HOLD or Route Midpoint Dark to IEX (350us Speed-Bump)"]
    GATE_TOX -- "No (Safe Maker Window)" --> GATE_DIR{"Favorable Directional Drift or Positive Maker Rebate?"}

    GATE_DIR -- "Adverse Drift > Threshold" --> SKEW_AGG["Opportunistic IOC / Midpoint Peg Capture"]
    GATE_DIR -- "Calm / Favorable" --> MAKER["PASSIVE MAKER POST: Capture Spread + Rebate on CBOE EDGX / NYSE"]

    TAKER & DARK & SKEW_AGG & MAKER --> TCA["Record Fill, Venue Rebate/Fee & Shortfall vs Arrival Price"]
```

---

## 5. 5-Stage Multi-Model Autonomous Agent Sequence Diagram

When an operator triggers `POST /api/v1/ai/agent-workflow`, FastTrade orchestrates all three NVIDIA Nemotron-3 model tiers alongside Tavily live search, isolated Nebius ConTree Cloud VMs, Monte Carlo risk verification, and live blotter execution under a single hierarchical LangSmith trace:

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Institutional Trader / CRO
    participant API as FastAPI Agent Orchestrator
    participant TAV as Tavily Finance Search
    participant MEM as AgentMemoryStore (SQLite)
    participant N30 as Nemotron-3 Nano 30B (Fast)
    participant N120 as Nemotron-3 Super 120B (Balanced)
    participant VM as Nebius ConTree Sandboxes (python:3.12-slim)
    participant MC as 500-Path Monte Carlo CaR Engine
    participant N550 as Nemotron-3 Ultra 550B (Ultra)
    participant PF as $25M Portfolio & Blotter
    participant LS as LangSmith Run-Tree Tracer

    Operator->>API: POST /api/v1/ai/agent-workflow (mission, symbol, auto_commit_trade)
    API->>LS: Open Root Run Trace (FastTrade-Nebius-EMS)

    rect rgb(16, 36, 58)
        Note over API,N30: Stage 1 — Microstructure, Live Catalyst & Episodic Memory Recon
        API->>TAV: Search live financial catalysts (topic="finance")
        API->>MEM: Query symbol-scoped episodic rules & past calibrations
        API->>N30: Synthesize L2 OFI, spread regime, news toxicity & desk mandates
        N30-->>API: Tactical Recon Telemetry
    end

    rect rgb(18, 44, 42)
        Note over API,N120: Stage 2 — Quantitative Policy & Parameter Synthesis
        API->>N120: Synthesize candidate Almgren-Chriss (lambda, N) & toxicity gates
        N120-->>API: Candidate Python Execution Policy + Calibrated Parameters
    end

    rect rgb(38, 30, 58)
        Note over API,VM: Stage 3 — 3-Cycle Self-Iterating Cloud Sandbox Verification
        API->>VM: Execute v1 -> v2 -> v3 policies in isolated ConTree Micro-VMs
        VM-->>API: 4/4 Unit Assertions PASS + Monotonic Shortfall Convergence + promoted_image_uuid
    end

    rect rgb(52, 34, 24)
        Note over API,N550: Stage 4 — 500-Path Monte Carlo CaR Stress & CRO Sign-Off
        API->>MC: Simulate 500 jump-diffusion + Hawkes toxicity paths
        MC-->>API: Expected IS, CaR_95%, CaR_99%, Guardrail Status
        API->>N550: Perform Committee-Grade CRO Risk Audit
        N550-->>API: Signed CRO Approval & Attribution Verdict
    end

    rect rgb(20, 48, 32)
        Note over API,PF: Stage 5 — Autonomous Blotter Fill & Persistent Memory Commit
        API->>PF: Book live-anchored SOR parent order into $25M MTM Blotter
        API->>MEM: Persist learned parameter calibration & action audit record
    end

    API->>LS: Finalize Root Trace & Generate Shareable Public Audit Link
    API-->>Operator: 5-Stage Result + Blotter Fill + LangSmith Trace ID
```

---

## 6. Self-Iterating Quant Coding Agent & Nebius ConTree Sandbox Lifecycle

```mermaid
stateDiagram-v2
    [*] --> PromptReceived
    state "1. Prompt & L2 Snapshot Context" as PromptReceived
    state "2. Synthesize v1.0 Baseline Policy (Super 120B)" as SynthV1
    state "3. AST Static Security Gate (Block Unsafe Imports/Syscalls)" as ASTCheck
    state "4. Boot Nebius ConTree VM (python:3.12-slim)" as BootVM
    state "5. Run 4 Deterministic L2 Replay Assertions" as UnitTests
    state "6. Compiler & Shortfall Diagnosis (v1 -> v2 -> v3)" as Diagnose
    state "7. Promote Immutable Snapshot (promoted_image_uuid)" as Promote
    state "8. Stage Verified Parameters to Live EMS" as DeployEMS

    PromptReceived --> SynthV1
    SynthV1 --> ASTCheck
    ASTCheck --> BootVM : AST Clean
    BootVM --> UnitTests : Parallel CoW Branch
    UnitTests --> Diagnose : Assertions < 4/4 or Suboptimal IS
    Diagnose --> ASTCheck : Refactored Policy (v2 Toxicity Gate / v3 AC + OFI Skew)
    UnitTests --> Promote : 4/4 Assertions PASS & Lowest Shortfall
    Promote --> DeployEMS
    DeployEMS --> [*]
```

---

## 7. Normalized Database Entity-Relationship Diagram (ERD)

FastTrade persists institutional accounts, cryptographic sessions, audit trails, `$25.0M` portfolio fills (mirrored asynchronously to Supabase PostgreSQL when configured), and persistent agent memories across **8 normalized tables**:

```mermaid
erDiagram
    USERS ||--o{ SESSIONS : "authenticates"
    USERS ||--o{ PASSWORD_RESETS : "requests"
    USERS ||--o{ AUDIT_LOGS : "generates"
    USERS ||--o{ FASTTRADE_TRADES : "executes"

    USERS {
        INTEGER id PK
        TEXT email UK
        TEXT password_hash
        TEXT full_name
        TEXT role
        TEXT title
        TEXT organization
        TEXT preferences_json
        INTEGER is_active
        INTEGER simulations_count
        TEXT created_at
        TEXT last_login_at
    }

    SESSIONS {
        TEXT token PK
        INTEGER user_id FK
        TEXT created_at
    }

    PASSWORD_RESETS {
        INTEGER id PK
        TEXT email
        TEXT reset_code
        TEXT expires_at
        INTEGER used
        TEXT created_at
    }

    AUDIT_LOGS {
        INTEGER id PK
        TEXT actor_email
        TEXT action
        TEXT details
        TEXT created_at
    }

    SYSTEM_CONFIG {
        INTEGER id PK
        TEXT config_json
    }

    FASTTRADE_TRADES {
        TEXT trade_id PK
        TEXT order_id
        TEXT user_email FK
        TEXT symbol
        TEXT asset_class
        TEXT side
        REAL quantity
        REAL arrival_price
        REAL avg_fill_price
        REAL notional_usd
        REAL shortfall_bps
        REAL twap_shortfall_bps
        REAL alpha_saved_usd
        TEXT venue_summary
        TEXT scenario
        TEXT strategy
        TEXT status
        TEXT executed_at
    }

    FASTTRADE_AGENT_MEMORIES {
        TEXT memory_id PK
        TEXT category
        TEXT symbol_scope
        TEXT rule_summary
        TEXT learned_parameters_json
        TEXT source
        REAL confidence
        TEXT created_at
    }

    FASTTRADE_AGENT_ACTIONS {
        TEXT action_id PK
        TEXT action_type
        TEXT symbol
        TEXT summary
        TEXT details_json
        TEXT model_used
        TEXT executed_at
    }
```
