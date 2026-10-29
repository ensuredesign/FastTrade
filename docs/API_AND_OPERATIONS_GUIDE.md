# FastTrade — Complete REST API Specification & Production Operations Guide

**Author & Lead Architect:** Ritesh Kochar ([`@ensuredesign`](https://github.com/ensuredesign) · `ensure01@gmail.com`)  
**Live Terminal:** [https://fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app) · **2-Min Demo Video:** [https://youtu.be/I9uMToKesDI](https://youtu.be/I9uMToKesDI)

---

## 1. Live Cross-Asset Market & Institutional Portfolio Overview

<p align="center">
  <img src="../public/fasttradeapp/market_liquidity.png" alt="Real-Time Markets and Liquidity Intelligence" width="100%" />
</p>

FastTrade exposes a versioned, OWASP-hardened **FastAPI v2.0** REST backend (`api/main.py`) with interactive OpenAPI / Swagger documentation automatically served at `http://127.0.0.1:8000/docs`.

---

## 2. Complete REST API Endpoint Reference (29 Endpoints)

### 2.1 System Health, Live Market Data & EMS Simulation (`api/routes/dashboard.py`)

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/api/v1/health` | Liveness probe returning service health and active subsystem flags. |
| `GET` | `/api/v1/market/live` | Live cross-asset snapshot from **Yahoo Finance v8** & **Coinbase Exchange L2** (`8` global benchmark indices + `8` tradable instruments with 5m OHLCV, cumulative session VWAP, realized $\sigma$, and signed OFI). |
| `GET` | `/api/v1/dashboard/snapshot` | Unified workspace payload: 5-level L2 book, Stoikov micro-price, Almgren–Chriss schedule, 4-venue SOR fills, 6-strategy TCA table, XGBoost toxicity timeline, and PyTorch GRU forecast (`?refresh=true` forces fresh simulation). |
| `POST` | `/api/v1/dashboard/run` | Execute custom simulation across `10` calibrated market regimes and `8` live-anchored instruments with custom $(\lambda, \theta_{\text{withdraw}}, \theta_{\text{urgency}}, N)$ sliders and optional `record_trade=true`. |
| `POST` | `/api/v1/dashboard/pretrade-stress` | Run 250-path jump-diffusion + Hawkes toxicity Pre-Trade Monte Carlo Cost-at-Risk ($\text{CaR}_{95\%}$, $\text{CaR}_{99\%}$), CRO guardrail check, and 1-click closed-form parameter calibration. |

### 2.2 `$25.0M` Mark-to-Market Portfolio & Trade Blotter (`api/routes/dashboard.py`)

<p align="center">
  <img src="../public/fasttradeapp/portfolio.png" alt="Portfolio, P&L and Execution Audit Trail" width="100%" />
</p>

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/api/v1/portfolio` | Retrieve isolated per-user `$25.0M` NAV summary, live MTM positions (`SPY`, `BTC-USD`, `AAPL`, `MSFT`, `NVDA`, `ETH-USD`, etc.), realized/unrealized P&L, cumulative SOR alpha saved vs. TWAP, and immutable trade blotter. |
| `POST` | `/api/v1/portfolio/trade` | Execute a live-anchored SOR parent order and book the resulting fill into SQLite + Supabase PostgreSQL (`fasttrade_trades`). |
| `POST` | `/api/v1/portfolio/reset` | Reset the active user's desk workspace back to the clean `$25.0M` institutional baseline book. |

### 2.3 Multi-Tier NVIDIA Nemotron-3 Agents, ConTree Sandboxes, Tavily & LangSmith (`api/routes/ai_copilot.py`)

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/api/v1/ai/status` | Unified status & latency telemetry for Nebius Token Factory (`Nano 30B`, `Super 120B`, `Ultra 550B`), ConTree Sandboxes Beta, Tavily Search, and LangSmith tracing. |
| `POST` | `/api/v1/ai/tactical-brief` | Sub-second L2 microstructure & tactical routing brief via `NVIDIA-Nemotron-3-Nano-30B-A3B`. |
| `POST` | `/api/v1/ai/copilot` | Context-aware quantitative copilot with dynamic tier routing, episodic memory recall, and real blotter/rule actions. |
| `POST` | `/api/v1/ai/tca-report` | Investment Committee Post-Trade TCA Executive Memo via `Nemotron-3-Ultra-550b-a55b` (exportable to `.md` / PDF). |
| `POST` | `/api/v1/ai/agent-workflow` | Execute the **5-Stage Autonomous Execution Workflow** (Recon -> Policy Synthesis -> 3-Cycle Sandbox Loop -> 500-Path CRO CaR Audit -> Live Blotter Fill). |
| `POST` | `/api/v1/ai/coding-agent` | Run the **Self-Iterating Quant Strategy Coding Agent** (`v1 -> v2 -> v3` AST + L2 replay unit-test loop). |
| `GET` | `/api/v1/ai/sandbox-status` | Probe live Nebius Token Factory Sandboxes Beta (`contree-sdk`) VM readiness and image quotas. |
| `POST` | `/api/v1/ai/sandbox-run` | Execute custom Python code (with optional `apt_packages` & `pip_packages`) inside an isolated `python:3.12-slim` ConTree micro-VM with CoW checkpointing. |
| `GET` | `/api/v1/ai/memory` | Retrieve persistent episodic & semantic desk rules (`fasttrade_agent_memories`) and autonomous action ledger (`fasttrade_agent_actions`). |
| `POST` | `/api/v1/ai/memory` | Persist a new operator execution preference or symbol-specific risk rule. |
| `POST` | `/api/v1/ai/tavily-search` | Live financial/news catalyst search via Tavily + Nemotron-3 toxicity impact synthesis. |
| `POST` | `/api/v1/ai/tavily-extract` | Extract clean institutional research text from any financial URL via Tavily `/extract`. |
| `GET` | `/api/v1/ai/langsmith-status` | Return active LangSmith project (`FastTrade-Nebius-EMS`) and recent traced run trees. |
| `POST` | `/api/v1/ai/langsmith-share/{trace_id}` | Publish a read-only public audit link (`https://smith.langchain.com/public/.../r`) for judges & compliance committees. |

### 2.4 Institutional Authentication, RBAC & CRO Governance (`api/routes/auth.py`)

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Provision an isolated institutional seat (`Trader` or `CRO`) with `PBKDF2-HMAC-SHA256` password hashing. |
| `POST` | `/api/v1/auth/login` | Authenticate desk credentials and issue a signed `HMAC-SHA256` bearer session token. |
| `POST` | `/api/v1/auth/demo-login` | 1-click institutional persona launch (`trader@fasttrade.ai` or `cro@fasttrade.ai`). |
| `GET` | `/api/v1/auth/me` | Validate bearer token and return active operator profile & saved algorithm preferences. |
| `PUT` | `/api/v1/auth/profile` | Update operator title, organization, or default execution preferences. |
| `POST` | `/api/v1/auth/forgot-password` | Generate time-boxed cryptographic reset code and dispatch via Resend. |
| `POST` | `/api/v1/auth/reset-password` | Verify reset code and rotate `PBKDF2-HMAC-SHA256` credentials. |
| `POST` | `/api/v1/auth/change-password` | Authenticated password rotation with audit log entry. |
| `GET` | `/api/v1/admin/overview` | CRO governance overview: global risk ceilings, seat directory, and immutable `audit_logs`. |
| `PUT` | `/api/v1/admin/config` | Update global `max_parent_order_size`, `global_toxicity_ceiling`, and venue permissions. |
| `PUT` | `/api/v1/admin/users/{user_id}` | Toggle seat activation or elevate/revoke `CRO` governance role. |
| `POST` | `/api/v1/admin/send-email` | Dispatch sanitized HTML TCA audit memo to Investment Committee recipients via Resend. |
| `POST` | `/api/v1/admin/supabase-sync` | Synchronize local SQLite trade blotter & audit state with cloud Supabase PostgreSQL. |

---

## 3. Sample API Payloads

### Execute 5-Stage Autonomous Workflow
```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/agent-workflow \
  -H "Content-Type: application/json" \
  -d '{
    "mission": "Optimize 1,000 NVDA parent buy order, verify in Nebius ConTree sandbox, run 500-path CRO CaR check, and commit fill to blotter.",
    "auto_commit_trade": true,
    "user_email": "trader@fasttrade.ai"
  }'
```

### Execute Isolated Nebius ConTree Cloud Sandbox (`python:3.12-slim`)
```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/sandbox-run \
  -H "Content-Type: application/json" \
  -d '{
    "python_code": "import math\nkappa = math.sqrt(1e-4 * 0.02**2 / 2.5e-5)\nprint(f\"Optimal Almgren-Chriss kappa={kappa:.6f}\")",
    "apt_packages": [],
    "pip_packages": [],
    "save_checkpoint": true
  }'
```

---

## 4. Environment Configuration (`.env`)

Copy `.env.example` to `.env` at the repository root. Note that **FastTrade runs 100% out-of-the-box locally even with zero external API keys** thanks to deterministic local quantitative fallbacks, and automatically activates cloud AI, sandboxes, search, and tracing as keys are supplied:

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `NEBIUS_API_KEY` | Recommended | Authenticates **Nebius Token Factory** (`Nemotron-3 Nano 30B / Super 120B / Ultra 550B`) AND **Nebius ConTree Sandboxes Beta** (`contree-sdk`). |
| `CONTREE_TOKEN` | Optional | Explicit token override for `contree-sdk` (defaults automatically to `NEBIUS_API_KEY` when omitted). |
| `LANGSMITH_API_KEY` | Recommended | Enables hierarchical run-tree tracing and 1-click public audit links on `smith.langchain.com`. |
| `LANGSMITH_TRACING` | Optional | Set to `true` to enable live LangSmith telemetry. |
| `LANGSMITH_PROJECT` | Optional | Project namespace in LangSmith (default: `FastTrade-Nebius-EMS`). |
| `TAVILY_API_KEY` | Optional | Enables live financial catalyst search (`topic="finance"`) and URL extraction. |
| `RESEND_API_KEY` | Optional | Enables HTML Investment Committee TCA email dispatch & password reset emails. |
| `FASTTRADE_SECRET_KEY` | Production | Cryptographic secret used to sign stateless `HMAC-SHA256` session tokens. |
| `SUPABASE_DB_URL` | Optional | PostgreSQL connection string for dual-write cloud trade blotter mirroring. |

---

## 5. Local Development, Testing & Production Deployment

### 5.1 Local Full-Stack Startup
```bash
# 1. Install Python 3.12+ quantitative & API dependencies
pip install -r requirements.txt

# 2. Install React 19 + TypeScript 5.7 frontend dependencies
cd frontend && npm install && cd ..

# 3. Start FastAPI Backend (http://127.0.0.1:8000 | Swagger: /docs)
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload

# 4. In a second terminal, start Vite Frontend (http://127.0.0.1:5173)
cd frontend && npm run dev
```

### 5.2 Automated Verification Suite
```bash
# Execute unit, contract, forecasting, microstructure, backtester, and API tests
python -m pytest -q

# Type-check & build production React bundle
cd frontend && npm run build
```

### 5.3 Unified Single-Port / Vercel Serverless Mode
When `frontend/dist` is built, `api/main.py` automatically mounts `/assets` and serves the compiled React SPA alongside `/api/v1/*` from a single unified ASGI service—matching the production deployment at [https://fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app).
