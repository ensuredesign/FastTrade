# FastTrade Institutional EMS & Quant Research Frontend

**Author & Lead Architect:** Ritesh Kochar (`ensuredesign` · `ensure01@gmail.com`)  
**Live Deployment:** [https://fasttrade-smoky.vercel.app](https://fasttrade-smoky.vercel.app)

The FastTrade frontend is a multi-tab institutional Execution Management System (EMS), Live Cross-Asset Market Monitor, Mark-to-Market Portfolio & Trade Blotter, and Quantitative Microstructure Research Terminal built with **React 19**, **TypeScript**, **Vite**, and **Plotly.js**.

---

## Institutional 8-Tab Workspace Architecture

| Tab | Module | Capabilities |
| :--- | :--- | :--- |
| **1. Live Market Overview** | `MarketOverviewHub.tsx` | Live Yahoo Finance v8 global market indices (`SPX`, `NDX`, `DJI`, `VIX`, `US10Y`, `BTC-USD`, `NVDA`, `EUR/USD`), live 5-minute intraday price vs. cumulative session VWAP chart, Cont–Kukanov–Stoikov OFI & spread regime chart, and 8-asset liquidity screener with 1-click EMS loading & order booking. |
| **2. Portfolio & Trade Book** | `PortfolioBlotterTab.tsx` | Real-time mark-to-market institutional position book ($25.0M desk capital allocation), FIFO/average-cost realized & unrealized P&L attribution, direct live SOR order ticket, cumulative execution alpha saved vs. TWAP ($ USD), and CSV-exportable immutable execution blotter. |
| **3. EMS Execution & L2 Book** | `OrderBook.tsx`, `Execution.tsx`, `ACSchedule.tsx` | Institutional parent order ticket, Almgren–Chriss & SOR parameter tuning sliders ($\lambda$, toxicity gate, urgency gate, slice count $N$), tick-by-tick replay scrubber, 5-level L2 Order Book with Stoikov micro-price, and closed-form Almgren–Chriss schedule. |
| **4. Multi-Venue SOR & TCA** | `VenueRouterCard.tsx`, `Performance.tsx` | Dynamic 4-venue liquidity allocation across `NYSE`, `NASDAQ`, `CBOE EDGX`, and `IEX` (dark midpoint speed-bump protection) + identical-replay 6-strategy Implementation Shortfall benchmark. |
| **5. Pre-Trade Monte Carlo** | `PreTradeStressCard.tsx` | 250-path stochastic jump-diffusion & Hawkes toxicity stress-tester computing Expected Shortfall, $\text{CaR}_{95\%}$, $\text{CaR}_{99\%}$, impact attribution, CRO guardrail verification, and 1-click closed-form parameter calibration. |
| **6. Quant Signals & LOB** | `Risk.tsx`, `Forecast.tsx`, `MarketFeatures.tsx` | ML adverse-selection toxicity probability timeline, 5-tick directional GRU forecaster, and 6-panel L2 order-book microstructure telemetry. |
| **7. AI Quant Copilot** | `NebiusAIPanel.tsx` | Multi-tier NVIDIA Nemotron-3 (`Nano 30B`, `Super 120B`, `Ultra 550B`) tactical execution brief, interactive quant copilot, and Investment Committee Post-Trade TCA Audit Memo. |
| **8. CRO Risk Governance** | `AdminPanel.tsx` | Chief Risk Officer global risk guardrails (max parent order ceiling, global adverse-selection toxicity ceiling), institutional seat directory, and compliance audit dispatch. |

---

## Development & Production Build

Start the FastAPI backend on port `8000`:

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

Start the Vite development server on port `5173`:

```bash
cd frontend
npm install
npm run dev
```

Build the production bundle (`frontend/dist/`):

```bash
cd frontend
npm run build
```
