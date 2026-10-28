# FastTrade — Institutional Technical Architecture, Quantitative Specification & Security Audit Report

**Author & Lead Architect:** Ritesh Kochar (`ensuredesign` · `ensure01@gmail.com`)  
**Platform:** FastTrade Institutional Execution Management System (EMS) & Quantitative Research Terminal  
**Live Production URL:** [https://fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app)  
**Repository:** [https://github.com/ensuredesign/FastTrade](https://github.com/ensuredesign/FastTrade)

---

## 1. Executive Summary

**FastTrade** is a full-stack institutional **Smart Order Routing (SOR), Live Market Microstructure, Mark-to-Market Portfolio & Trade Blotter, and Quantitative Execution Terminal** engineered by **Ritesh Kochar**.

It bridges high-frequency order-book microstructure mathematics with live cross-asset market data, persistent multi-asset portfolio accounting, and multi-tier LLM reasoning:

1. **Live Cross-Asset Market Feed (`services/market_data_service.py`):**
   - Concurrent live fetching from **Yahoo Finance v8** (`interval=5m&range=1d`) and **Coinbase Exchange L2 Book** (`products/{id}/book?level=2`).
   - Streams live quotes, 24h changes, session high/low ranges, annualized realized volatility ($\sigma$), signed Order Flow Imbalance ($\text{OFI}$), and 5-minute intraday price & cumulative session VWAP curves across 8 global benchmarks (`SPX`, `NDX`, `DJI`, `VIX`, `US10Y`, `BTC-USD`, `NVDA`, `EUR/USD`) and 8 tradable institutional instruments (`NVDA`, `BTC-USD`, `SPY`, `AAPL`, `MSFT`, `ETH-USD`, `ES-FUT`, `NQ-FUT`).
2. **Real-Time Mark-to-Market Portfolio & Execution Trade Blotter (`services/portfolio_service.py`):**
   - Manages a $25,000,000 institutional multi-asset position book with average-cost realized & unrealized P&L attribution, gross/net exposure tracking, cumulative implementation shortfall savings vs. TWAP ($ USD), and a CSV-exportable immutable execution blotter.
3. **Closed-Form Almgren–Chriss & 250-Path Pre-Trade Monte Carlo Cost-at-Risk (`execution/almgren_chriss.py`, `api/routes/dashboard.py`):**
   - Computes optimal hyperbolic execution trajectories $x(t_j) = X_0 \sinh(\kappa(T-t_j))/\sinh(\kappa T)$ and simulates 250 stochastic jump-diffusion + Hawkes toxicity paths to quantify Expected Implementation Shortfall, $\text{CaR}_{95\%}$, $\text{CaR}_{99\%}$, and 1-click closed-form parameter calibration.
4. **4-Venue Fragmented Liquidity Router & 6-Strategy Identical-Replay Backtester (`execution/venue_router.py`, `backtest/backtester.py`):**
   - Allocates child slices dynamically across `NYSE`, `NASDAQ`, `CBOE EDGX`, and `IEX` (dark midpoint speed-bump protection) and benchmarks `FastTrade (ML + NVIDIA + AC)` against `Market`, `TWAP`, `VWAP`, `Almgren-Chriss`, and `Proposed (ML + AC)` on identical tick streams.
5. **Multi-Tier NVIDIA Nemotron-3 Reasoning Engine (`services/nebius_ai.py`):**
   - Routes tactical briefs (`Nano 30B`), interactive quant Q&A (`Super 120B`), and Investment Committee Post-Trade TCA Audit Memos (`Ultra 550B`).

---

## 2. Application Security & OWASP Audit Summary

| Security Control | Implementation in FastTrade | Verification Status |
| :--- | :--- | :--- |
| **Cryptographic Password Hashing** | `PBKDF2-HMAC-SHA256` with 100,000 iterations, 16-byte per-user CSPRNG salt (`secrets.token_hex(16)`), and constant-time digest verification (`secrets.compare_digest`). | **VERIFIED** (`services/auth_service.py`) |
| **Stateless HMAC Session Tokens** | Custom `HMAC-SHA256` signed bearer tokens with strict expiration validation (`exp` claim). | **VERIFIED** (`services/auth_service.py`) |
| **OWASP HTTP Security Headers** | Global ASGI middleware injecting `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`. | **VERIFIED** (`api/main.py`) |
| **HTML Injection / XSS Sanitization** | `html.escape(..., quote=True)` applied to all dynamic fields prior to HTML email dispatch. | **VERIFIED** (`services/email_service.py`) |
| **CRO Risk Guardrail Enforcement** | Server-side enforcement of `max_parent_order_size` and `global_toxicity_ceiling` across all simulation and pre-trade Monte Carlo endpoints. | **VERIFIED** (`api/routes/dashboard.py`) |
| **Cross-Platform Pure-NumPy Inference** | Exported pure-NumPy weight artifacts (`adverse_selection_numpy.npz` & `directional_forecaster_numpy.npz`) eliminating `pickle` deserialization and cold-start overhead on serverless deployments. | **VERIFIED** (`models/predictor.py`, `models/local_forecaster.py`) |

---

## 3. REST API Reference

| Method & Endpoint | Description |
| :--- | :--- |
| `GET /api/v1/health` | Liveness & health probe (`{"status": "ok"}`). |
| `GET /api/v1/market/live` | Live Yahoo Finance v8 & Coinbase L2 market snapshot (`indices` + `instruments` with 5m intraday series). |
| `GET /api/v1/portfolio` | Real-time mark-to-market institutional portfolio summary, open positions, and trade blotter. |
| `POST /api/v1/portfolio/trade` | Execute a live-anchored SOR parent order and book the transaction into the portfolio & trade blotter. |
| `POST /api/v1/portfolio/reset` | Reset the demo institutional portfolio to the baseline $25.0M multi-asset book. |
| `GET /api/v1/dashboard/snapshot` | Retrieve the unified L2 order book, execution trajectory, 6-strategy TCA, and microstructure telemetry snapshot. |
| `POST /api/v1/dashboard/run` | Execute a custom simulation across 10 market regimes and 8 live instruments (with optional `record_trade=true`). |
| `POST /api/v1/dashboard/pretrade-stress` | Run 250-path Pre-Trade Monte Carlo Cost-at-Risk ($\text{CaR}_{95\%}$ / $\text{CaR}_{99\%}$) & optimal parameter calibration. |
| `GET /api/v1/ai/status` | Multi-tier NVIDIA Nemotron-3 router status & latency telemetry. |
| `POST /api/v1/ai/tactical-brief` | Generate sub-second tactical execution brief. |
| `POST /api/v1/ai/copilot` | Query the interactive quantitative execution copilot. |
| `POST /api/v1/ai/tca-report` | Generate an Investment Committee Post-Trade TCA Audit Memo. |
