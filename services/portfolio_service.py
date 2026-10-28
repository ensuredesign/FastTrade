"""FastTrade Institutional Trade Book (Order Blotter) & Live Mark-to-Market Portfolio Service.

Maintains a persistent, per-user isolated ledger of executed parent orders, venue fills,
average cost basis, realized P&L, and live mark-to-market unrealized P&L anchored to
Yahoo Finance & Coinbase live market quotes. Dual-writes to Self-Hosted PostgreSQL and local SQLite.
"""

from __future__ import annotations

import hashlib
import json
import os
import secrets
import sqlite3
import tempfile
import threading
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

from services.market_data_service import market_data_service

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _resolve_db_path() -> Path:
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        return Path(tempfile.gettempdir()) / "fasttrade.db"
    return PROJECT_ROOT / "data" / "fasttrade.db"


DB_PATH = _resolve_db_path()
INITIAL_DESK_CAPITAL_USD = 25_000_000.0


class PortfolioService:
    """Institutional Trade Blotter & Real-Time Mark-to-Market Portfolio Engine (Per-User Isolated)."""

    def __init__(self, db_path: Path = DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._seed_initial_trades("trader@fasttrade.ai")
        self._seed_initial_trades("admin@fasttrade.ai")

    @property
    def supabase_url(self) -> str:
        return os.environ.get("SUPABASE_URL", "https://fasttrade-sb.propixer.in").rstrip("/")

    @property
    def supabase_service_key(self) -> str:
        return os.environ.get(
            "SUPABASE_SERVICE_ROLE_KEY",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc5MzIwMzIwMCwiZXhwIjo0OTQ4ODc2ODAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.rKgIAVDQLEQ_67T_n-aWESFOa29rGEmrasIH3XtaMSs",
        ).strip()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _supabase_pg_async(self, query: str) -> None:
        def _worker() -> None:
            url = f"{self.supabase_url}/pg/query"
            body = json.dumps({"query": query}).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "apikey": self.supabase_service_key,
                    "Authorization": f"Bearer {self.supabase_service_key}",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=4):
                    pass
            except Exception:
                pass

        threading.Thread(target=_worker, daemon=True).start()

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS fasttrade_trades (
                    trade_id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    user_email TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    asset_class TEXT NOT NULL,
                    side TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    arrival_price REAL NOT NULL,
                    avg_fill_price REAL NOT NULL,
                    notional_usd REAL NOT NULL,
                    shortfall_bps REAL NOT NULL,
                    twap_shortfall_bps REAL NOT NULL,
                    alpha_saved_usd REAL NOT NULL,
                    venue_summary TEXT NOT NULL,
                    scenario TEXT NOT NULL,
                    strategy TEXT NOT NULL DEFAULT 'FastTrade SOR',
                    status TEXT NOT NULL DEFAULT 'FILLED',
                    executed_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_fasttrade_trades_user ON fasttrade_trades(user_email);
                """
            )
            conn.commit()

        # Ensure PostgreSQL table exists asynchronously
        self._supabase_pg_async(
            """
            CREATE TABLE IF NOT EXISTS public.fasttrade_trades (
                trade_id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                user_email TEXT NOT NULL,
                symbol TEXT NOT NULL,
                asset_class TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity DOUBLE PRECISION NOT NULL,
                arrival_price DOUBLE PRECISION NOT NULL,
                avg_fill_price DOUBLE PRECISION NOT NULL,
                notional_usd DOUBLE PRECISION NOT NULL,
                shortfall_bps DOUBLE PRECISION NOT NULL,
                twap_shortfall_bps DOUBLE PRECISION NOT NULL,
                alpha_saved_usd DOUBLE PRECISION NOT NULL,
                venue_summary TEXT NOT NULL,
                scenario TEXT NOT NULL,
                strategy TEXT NOT NULL DEFAULT 'FastTrade SOR',
                status TEXT NOT NULL DEFAULT 'FILLED',
                executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

    def _seed_initial_trades(self, user_email: str = "trader@fasttrade.ai") -> None:
        """Seed isolated initial institutional portfolio trades for a specific user account."""
        clean_email = (user_email or "trader@fasttrade.ai").strip().lower()
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM fasttrade_trades WHERE LOWER(user_email) = LOWER(?)",
                (clean_email,),
            ).fetchone()
            if row and int(row["cnt"]) > 0:
                return

        # Fetch live quotes so initial seed entry prices are realistic relative to current live market
        live_snap = market_data_service.get_live_market_snapshot()
        price_map: Dict[str, float] = {
            inst["symbol"]: float(inst["price"]) for inst in live_snap.get("instruments", [])
        }

        user_tag = hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:6].upper()
        now = datetime.now(timezone.utc)
        seed_specs = [
            {
                "trade_id": f"TRD-{user_tag}-101",
                "order_id": f"ORD-{user_tag}-801",
                "user_email": clean_email,
                "symbol": "NVDA",
                "asset_class": "US Large-Cap Equity",
                "side": "buy",
                "quantity": 4500.0,
                "entry_discount": 0.986,
                "shortfall_bps": 2.42,
                "twap_shortfall_bps": 6.85,
                "venue_summary": "NASDAQ 39% · IEX 31% · CBOE EDGX 18% · NYSE 12%",
                "scenario": "normal_market",
                "minutes_ago": 215,
            },
            {
                "trade_id": f"TRD-{user_tag}-102",
                "order_id": f"ORD-{user_tag}-802",
                "user_email": clean_email,
                "symbol": "BTC-USD",
                "asset_class": "Crypto Spot & Perp",
                "side": "buy",
                "quantity": 18.5,
                "entry_discount": 0.991,
                "shortfall_bps": 1.85,
                "twap_shortfall_bps": 5.90,
                "venue_summary": "Coinbase 44% · CME 28% · Binance 28%",
                "scenario": "low_adverse_selection",
                "minutes_ago": 170,
            },
            {
                "trade_id": f"TRD-{user_tag}-103",
                "order_id": f"ORD-{user_tag}-803",
                "user_email": clean_email,
                "symbol": "SPY",
                "asset_class": "US Index ETF",
                "side": "buy",
                "quantity": 3200.0,
                "entry_discount": 0.994,
                "shortfall_bps": 1.12,
                "twap_shortfall_bps": 3.74,
                "venue_summary": "NYSE Arca 41% · IEX 33% · NASDAQ 26%",
                "scenario": "normal_market",
                "minutes_ago": 135,
            },
            {
                "trade_id": f"TRD-{user_tag}-104",
                "order_id": f"ORD-{user_tag}-804",
                "user_email": clean_email,
                "symbol": "AAPL",
                "asset_class": "US Large-Cap Equity",
                "side": "buy",
                "quantity": 2800.0,
                "entry_discount": 0.992,
                "shortfall_bps": 1.94,
                "twap_shortfall_bps": 5.12,
                "venue_summary": "NASDAQ 42% · IEX 34% · CBOE EDGX 24%",
                "scenario": "normal_market",
                "minutes_ago": 95,
            },
            {
                "trade_id": f"TRD-{user_tag}-105",
                "order_id": f"ORD-{user_tag}-805",
                "user_email": clean_email,
                "symbol": "ETH-USD",
                "asset_class": "Crypto Spot & Perp",
                "side": "buy",
                "quantity": 240.0,
                "entry_discount": 0.988,
                "shortfall_bps": 2.78,
                "twap_shortfall_bps": 7.45,
                "venue_summary": "Coinbase 48% · Kraken 29% · Binance 23%",
                "scenario": "high_adverse_selection",
                "minutes_ago": 62,
            },
            {
                "trade_id": f"TRD-{user_tag}-106",
                "order_id": f"ORD-{user_tag}-806",
                "user_email": clean_email,
                "symbol": "NVDA",
                "asset_class": "US Large-Cap Equity",
                "side": "sell",
                "quantity": 1000.0,
                "entry_discount": 1.003,
                "shortfall_bps": 2.15,
                "twap_shortfall_bps": 6.40,
                "venue_summary": "IEX 38% · NASDAQ 35% · CBOE EDGX 27%",
                "scenario": "high_volatility",
                "minutes_ago": 28,
            },
            {
                "trade_id": f"TRD-{user_tag}-107",
                "order_id": f"ORD-{user_tag}-807",
                "user_email": clean_email,
                "symbol": "MSFT",
                "asset_class": "US Large-Cap Equity",
                "side": "buy",
                "quantity": 1600.0,
                "entry_discount": 0.995,
                "shortfall_bps": 1.68,
                "twap_shortfall_bps": 4.82,
                "venue_summary": "NASDAQ 40% · IEX 32% · NYSE 28%",
                "scenario": "normal_market",
                "minutes_ago": 14,
            },
        ]

        with self._connect() as conn:
            for s in seed_specs:
                live_p = price_map.get(s["symbol"], 200.0)
                arrival_p = round(live_p * float(s["entry_discount"]), 2)
                slip_mult = 1.0 + (float(s["shortfall_bps"]) / 10000.0) * (
                    1.0 if s["side"] == "buy" else -1.0
                )
                fill_p = round(arrival_p * slip_mult, 2)
                notional = round(float(s["quantity"]) * fill_p, 2)
                alpha_bps = float(s["twap_shortfall_bps"]) - float(s["shortfall_bps"])
                alpha_usd = round((alpha_bps / 10000.0) * notional, 2)
                exec_ts = (now - timedelta(minutes=int(s["minutes_ago"]))).isoformat()

                conn.execute(
                    """
                    INSERT OR IGNORE INTO fasttrade_trades (
                        trade_id, order_id, user_email, symbol, asset_class, side,
                        quantity, arrival_price, avg_fill_price, notional_usd,
                        shortfall_bps, twap_shortfall_bps, alpha_saved_usd,
                        venue_summary, scenario, strategy, status, executed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FastTrade SOR', 'FILLED', ?)
                    """,
                    (
                        s["trade_id"],
                        s["order_id"],
                        s["user_email"],
                        s["symbol"],
                        s["asset_class"],
                        s["side"],
                        s["quantity"],
                        arrival_p,
                        fill_p,
                        notional,
                        s["shortfall_bps"],
                        s["twap_shortfall_bps"],
                        alpha_usd,
                        s["venue_summary"],
                        s["scenario"],
                        exec_ts,
                    ),
                )
            conn.commit()

    def record_trade_from_snapshot(
        self,
        snapshot_payload: Dict[str, Any],
        symbol: str = "BTC-USD",
        user_email: str = "trader@fasttrade.ai",
    ) -> Dict[str, Any]:
        """Record an executed parent order from a FastTrade simulation snapshot into the user's isolated Trade Book."""
        clean_email = (user_email or "trader@fasttrade.ai").strip().lower()
        self._seed_initial_trades(clean_email)

        inst = market_data_service.get_instrument_quote(symbol)
        norm_symbol = inst["symbol"]
        asset_class = inst["asset_class"]

        execution = snapshot_payload.get("execution") or {}
        market = snapshot_payload.get("market") or {}
        perf_results = (snapshot_payload.get("performance") or {}).get("results") or []
        venue_routing = snapshot_payload.get("venue_routing") or {}

        side = str(execution.get("side") or "buy").lower()
        qty = float(execution.get("filled_quantity") or execution.get("target_quantity") or 100.0)
        avg_fill = float(execution.get("average_execution_price") or market.get("mid_price") or inst["price"])

        sf_row = next(
            (r for r in perf_results if r.get("strategy") in ("fasttrade", "proposed")),
            None,
        )
        twap_row = next((r for r in perf_results if r.get("strategy") == "twap"), None)

        shortfall_bps = float(sf_row.get("implementation_shortfall_bps", 2.1)) if sf_row else 2.1
        twap_bps = float(twap_row.get("implementation_shortfall_bps", 6.2)) if twap_row else 6.2

        # Derive arrival price consistent with avg_fill and shortfall_bps
        slip_sign = 1.0 if side == "buy" else -1.0
        arrival_price = round(avg_fill / (1.0 + slip_sign * (shortfall_bps / 10000.0)), 4 if avg_fill < 10 else 2)
        avg_fill = round(avg_fill, 4 if avg_fill < 10 else 2)
        notional_usd = round(qty * avg_fill, 2)
        alpha_saved_usd = round(((twap_bps - shortfall_bps) / 10000.0) * notional_usd, 2)

        allocs = venue_routing.get("allocations") or []
        if allocs:
            top_v = sorted(allocs, key=lambda x: float(x.get("share_pct", 0)), reverse=True)[:3]
            venue_summary = " · ".join(
                f"{v.get('venue_id', 'VENUE')} {float(v.get('share_pct', 0)):.0f}%" for v in top_v
            )
        else:
            venue_summary = f"{inst['primary_venue']}"

        trade_id = f"TRD-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
        order_id = str(execution.get("order_id") or f"ORD-FT-{secrets.token_hex(2).upper()}")
        scenario = str(snapshot_payload.get("scenario") or "normal_market")
        executed_at = datetime.now(timezone.utc).isoformat()

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO fasttrade_trades (
                    trade_id, order_id, user_email, symbol, asset_class, side,
                    quantity, arrival_price, avg_fill_price, notional_usd,
                    shortfall_bps, twap_shortfall_bps, alpha_saved_usd,
                    venue_summary, scenario, strategy, status, executed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FastTrade SOR', 'FILLED', ?)
                """,
                (
                    trade_id,
                    order_id,
                    clean_email,
                    norm_symbol,
                    asset_class,
                    side,
                    qty,
                    arrival_price,
                    avg_fill,
                    notional_usd,
                    round(shortfall_bps, 2),
                    round(twap_bps, 2),
                    alpha_saved_usd,
                    venue_summary,
                    scenario,
                    executed_at,
                ),
            )
            conn.commit()

        # Sync asynchronously to Self-Hosted PostgreSQL
        safe_venue = venue_summary.replace("'", "''")
        safe_email = clean_email.replace("'", "''")
        self._supabase_pg_async(
            f"""
            INSERT INTO public.fasttrade_trades (
                trade_id, order_id, user_email, symbol, asset_class, side,
                quantity, arrival_price, avg_fill_price, notional_usd,
                shortfall_bps, twap_shortfall_bps, alpha_saved_usd,
                venue_summary, scenario, strategy, status, executed_at
            ) VALUES (
                '{trade_id}', '{order_id}', '{safe_email}', '{norm_symbol}', '{asset_class}', '{side}',
                {qty}, {arrival_price}, {avg_fill}, {notional_usd},
                {round(shortfall_bps, 2)}, {round(twap_bps, 2)}, {alpha_saved_usd},
                '{safe_venue}', '{scenario}', 'FastTrade SOR', 'FILLED', '{executed_at}'
            ) ON CONFLICT (trade_id) DO NOTHING;
            """
        )

        return {
            "trade_id": trade_id,
            "order_id": order_id,
            "user_email": clean_email,
            "symbol": norm_symbol,
            "side": side,
            "quantity": qty,
            "avg_fill_price": avg_fill,
            "notional_usd": notional_usd,
            "shortfall_bps": round(shortfall_bps, 2),
            "alpha_saved_usd": alpha_saved_usd,
            "executed_at": executed_at,
        }

    def get_portfolio_and_blotter(
        self,
        force_live_refresh: bool = False,
        user_email: str = "trader@fasttrade.ai",
    ) -> Dict[str, Any]:
        """Compute live mark-to-market institutional positions, P&L, and full trade blotter for the specific user."""
        clean_email = (user_email or "trader@fasttrade.ai").strip().lower()
        self._seed_initial_trades(clean_email)

        live_snap = market_data_service.get_live_market_snapshot(force_refresh=force_live_refresh)
        inst_map: Dict[str, Dict[str, Any]] = {
            inst["symbol"]: inst for inst in live_snap.get("instruments", [])
        }

        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM fasttrade_trades WHERE LOWER(user_email) = LOWER(?) ORDER BY executed_at ASC",
                (clean_email,),
            ).fetchall()

        trades_asc = [dict(r) for r in rows]

        # Reconstruct positions & realized P&L using institutional average-cost accounting
        pos_state: Dict[str, Dict[str, Any]] = {}
        cash_balance = INITIAL_DESK_CAPITAL_USD
        total_volume_usd = 0.0
        total_alpha_saved_usd = 0.0
        weighted_is_num = 0.0

        for t in trades_asc:
            sym = t["symbol"]
            side = str(t["side"]).lower()
            qty = float(t["quantity"])
            fill_p = float(t["avg_fill_price"])
            notional = float(t["notional_usd"])
            alpha_usd = float(t["alpha_saved_usd"])
            is_bps = float(t["shortfall_bps"])

            total_volume_usd += notional
            total_alpha_saved_usd += alpha_usd
            weighted_is_num += is_bps * notional

            if sym not in pos_state:
                inst_meta = inst_map.get(sym, {})
                pos_state[sym] = {
                    "symbol": sym,
                    "name": inst_meta.get("name", sym),
                    "asset_class": t["asset_class"],
                    "primary_venue": inst_meta.get("primary_venue", "Multi-Venue SOR"),
                    "net_quantity": 0.0,
                    "avg_entry_price": 0.0,
                    "realized_pnl_usd": 0.0,
                    "trades_count": 0,
                    "alpha_saved_usd": 0.0,
                    "last_traded_at": t["executed_at"],
                }

            st = pos_state[sym]
            st["trades_count"] += 1
            st["alpha_saved_usd"] += alpha_usd
            st["last_traded_at"] = t["executed_at"]

            signed_qty = qty if side == "buy" else -qty
            cash_balance -= signed_qty * fill_p

            cur_q = st["net_quantity"]
            cur_avg = st["avg_entry_price"]

            if cur_q == 0.0 or (cur_q > 0 and signed_qty > 0) or (cur_q < 0 and signed_qty < 0):
                # Adding to existing position direction
                new_q = cur_q + signed_qty
                st["avg_entry_price"] = (
                    (abs(cur_q) * cur_avg + abs(signed_qty) * fill_p) / abs(new_q)
                    if abs(new_q) > 1e-9
                    else 0.0
                )
                st["net_quantity"] = new_q
            else:
                # Reducing or flipping position
                closed_qty = min(abs(cur_q), abs(signed_qty))
                direction_mult = 1.0 if cur_q > 0 else -1.0
                realized_delta = closed_qty * (fill_p - cur_avg) * direction_mult
                st["realized_pnl_usd"] += realized_delta

                rem_qty = cur_q + signed_qty
                st["net_quantity"] = rem_qty
                if abs(rem_qty) < 1e-9:
                    st["net_quantity"] = 0.0
                    st["avg_entry_price"] = 0.0
                elif (cur_q > 0 and rem_qty < 0) or (cur_q < 0 and rem_qty > 0):
                    # Flipped direction
                    st["avg_entry_price"] = fill_p

        # Mark every position to market against live Yahoo Finance prices
        positions_out: List[Dict[str, Any]] = []
        gross_exposure_usd = 0.0
        net_exposure_usd = 0.0
        total_unrealized_pnl = 0.0
        total_realized_pnl = 0.0

        for sym, st in pos_state.items():
            inst_meta = inst_map.get(sym, {})
            live_price = float(inst_meta.get("price") or st["avg_entry_price"] or 100.0)
            day_change_pct = float(inst_meta.get("change_pct") or 0.0)
            net_q = float(st["net_quantity"])
            avg_entry = float(st["avg_entry_price"])
            realized_pnl = float(st["realized_pnl_usd"])

            market_val = net_q * live_price
            cost_basis = abs(net_q) * avg_entry
            if abs(net_q) > 1e-9 and avg_entry > 0:
                direction_mult = 1.0 if net_q > 0 else -1.0
                unrealized_pnl = abs(net_q) * (live_price - avg_entry) * direction_mult
                unrealized_pct = ((live_price - avg_entry) / avg_entry) * 100.0 * direction_mult
            else:
                unrealized_pnl = 0.0
                unrealized_pct = 0.0

            total_pnl = realized_pnl + unrealized_pnl
            gross_exposure_usd += abs(market_val)
            net_exposure_usd += market_val
            total_unrealized_pnl += unrealized_pnl
            total_realized_pnl += realized_pnl

            decimals = 4 if live_price < 10 else 2
            positions_out.append(
                {
                    "symbol": sym,
                    "name": st["name"],
                    "asset_class": st["asset_class"],
                    "primary_venue": st["primary_venue"],
                    "side": "LONG" if net_q > 0 else ("SHORT" if net_q < 0 else "FLAT"),
                    "net_quantity": round(net_q, 4),
                    "avg_entry_price": round(avg_entry, decimals),
                    "live_price": round(live_price, decimals),
                    "day_change_pct": round(day_change_pct, 2),
                    "cost_basis_usd": round(cost_basis, 2),
                    "market_value_usd": round(market_val, 2),
                    "unrealized_pnl_usd": round(unrealized_pnl, 2),
                    "unrealized_pnl_pct": round(unrealized_pct, 2),
                    "realized_pnl_usd": round(realized_pnl, 2),
                    "total_pnl_usd": round(total_pnl, 2),
                    "alpha_saved_usd": round(st["alpha_saved_usd"], 2),
                    "trades_count": st["trades_count"],
                    "last_traded_at": st["last_traded_at"],
                }
            )

        positions_out.sort(key=lambda x: abs(x["market_value_usd"]), reverse=True)
        for p in positions_out:
            p["weight_pct"] = (
                round((abs(p["market_value_usd"]) / gross_exposure_usd) * 100.0, 1)
                if gross_exposure_usd > 0
                else 0.0
            )

        total_nav_usd = cash_balance + net_exposure_usd
        total_pnl_usd = total_realized_pnl + total_unrealized_pnl
        total_return_pct = ((total_nav_usd - INITIAL_DESK_CAPITAL_USD) / INITIAL_DESK_CAPITAL_USD) * 100.0
        avg_shortfall_bps = (weighted_is_num / total_volume_usd) if total_volume_usd > 0 else 0.0

        trades_desc = list(reversed(trades_asc))

        return {
            "account_owner_email": clean_email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "market_data_provider": live_snap.get("provider", "Yahoo Finance v8 Live"),
            "is_live_market": live_snap.get("is_live", True),
            "summary": {
                "starting_capital_usd": round(INITIAL_DESK_CAPITAL_USD, 2),
                "total_nav_usd": round(total_nav_usd, 2),
                "cash_balance_usd": round(cash_balance, 2),
                "gross_exposure_usd": round(gross_exposure_usd, 2),
                "net_exposure_usd": round(net_exposure_usd, 2),
                "total_unrealized_pnl_usd": round(total_unrealized_pnl, 2),
                "total_realized_pnl_usd": round(total_realized_pnl, 2),
                "total_pnl_usd": round(total_pnl_usd, 2),
                "total_return_pct": round(total_return_pct, 2),
                "cumulative_alpha_saved_usd": round(total_alpha_saved_usd, 2),
                "avg_shortfall_bps": round(avg_shortfall_bps, 2),
                "total_trades_count": len(trades_desc),
                "total_traded_volume_usd": round(total_volume_usd, 2),
                "open_positions_count": sum(1 for p in positions_out if abs(p["net_quantity"]) > 1e-9),
            },
            "positions": positions_out,
            "trades": trades_desc[:100],
        }

    def reset_demo_portfolio(self, user_email: str = "trader@fasttrade.ai") -> Dict[str, Any]:
        clean_email = (user_email or "trader@fasttrade.ai").strip().lower()
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM fasttrade_trades WHERE LOWER(user_email) = LOWER(?)",
                (clean_email,),
            )
            conn.commit()
        self._seed_initial_trades(clean_email)
        return self.get_portfolio_and_blotter(user_email=clean_email)


portfolio_service = PortfolioService()
