# Contributing to FastTrade

Thank you for your interest in contributing to **FastTrade** — Institutional Smart Order Routing, Level-2 Market Microstructure & Multi-Agent Quantitative Execution Terminal.

---

## Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/ensuredesign/FastTrade.git
cd FastTrade

# 2. Install Python 3.12+ backend & quantitative packages
pip install -r requirements.txt

# 3. Install React 19 + TypeScript 5.7 frontend packages
cd frontend && npm install && cd ..

# 4. Configure optional cloud environment keys
cp .env.example .env
```

---

## Architectural Guardrails

Before modifying quantitative, forecasting, or API modules, review the engineering specifications in [`docs/`](./docs/README.md):

1. **Strict Signal Separation:** Keep adverse-selection risk (`models/predictor.py`), short-horizon directional forecasts (`models/local_forecaster.py`), and Almgren–Chriss inventory urgency (`execution/almgren_chriss.py`) strictly decoupled.
2. **Chronological Integrity (Zero Look-Ahead Leakage):** Feature rolling windows, train/validation/test splits (`data/splitter.py`), and `StandardScaler` fitting (`data/normalizer.py`) must never inspect future observations.
3. **Canonical Forecasting Contract (`20 × 14`):** Any modification to `NVIDIA_FORECAST_FEATURES`, `DEFAULT_FORECAST_CONTEXT_WINDOW` (`20`), or `DEFAULT_FORECAST_HORIZON` (`5`) in `data/contracts.py` must follow [`docs/CONTRACT_CHANGE_POLICY.md`](./docs/CONTRACT_CHANGE_POLICY.md).
4. **No Secrets in Source Control:** Never commit `.env` files, raw API keys, or local `.db` / `.sqlite3` artifacts.

---

## Mandatory Pre-PR Verification Checklist

Every pull request must pass the full verification suite cleanly before merge:

```bash
# 1. Run full automated unit, contract, microstructure, and API test suite
python -m pytest -q

# 2. Verify Python bytecode compilation across modified modules
python -m compileall api data execution features models services strategies

# 3. Verify TypeScript strict build on the React 19 frontend
cd frontend && npm run build && cd ..

# 4. Check git whitespace & patch cleanliness
git diff --check
```
