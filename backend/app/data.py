"""Market data layer: live Yahoo Finance data with a small in-memory cache.

Set DATA_SOURCE=demo to use simulated prices (offline development only).
"""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable

import numpy as np
import pandas as pd

from . import config

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tiny TTL cache
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, Any]] = {}
_cache_lock = threading.Lock()


def cached(key: str, ttl: float, fn: Callable[[], Any]) -> Any:
    now = time.time()
    with _cache_lock:
        hit = _cache.get(key)
        if hit and now - hit[0] < ttl:
            return hit[1]
    value = fn()
    with _cache_lock:
        _cache[key] = (now, value)
    return value


_pool = ThreadPoolExecutor(max_workers=12)


class SymbolNotFound(Exception):
    pass


RANGES: dict[str, tuple[str, str]] = {
    # range -> (yahoo period, interval)
    "1d": ("1d", "5m"),
    "5d": ("5d", "15m"),
    "1mo": ("1mo", "1d"),
    "3mo": ("3mo", "1d"),
    "6mo": ("6mo", "1d"),
    "1y": ("1y", "1d"),
    "5y": ("5y", "1wk"),
    "max": ("max", "1mo"),
}


def _clean_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
    df = df.apply(pd.to_numeric, errors="coerce").dropna(subset=["Close"])
    df.index = pd.to_datetime(df.index)
    return df[~df.index.duplicated(keep="last")]


# ---------------------------------------------------------------------------
# Yahoo implementation
# ---------------------------------------------------------------------------
def _yf():
    import yfinance as yf  # imported lazily so demo mode never needs network

    return yf


def _yahoo_history(symbol: str, period: str, interval: str) -> tuple[pd.DataFrame, dict]:
    t = _yf().Ticker(symbol)
    df = t.history(period=period, interval=interval, auto_adjust=True, prepost=False)
    meta = {}
    try:
        meta = t.history_metadata or {}
    except Exception:  # noqa: BLE001
        pass
    return _clean_ohlcv(df), meta


def _market_state(meta: dict) -> str:
    try:
        reg = meta["currentTradingPeriod"]["regular"]
        now = time.time()
        if reg["start"] <= now <= reg["end"]:
            return "OPEN"
        pre = meta["currentTradingPeriod"].get("pre")
        if pre and pre["start"] <= now < reg["start"]:
            return "PRE"
        post = meta["currentTradingPeriod"].get("post")
        if post and reg["end"] < now <= post["end"]:
            return "POST"
    except Exception:  # noqa: BLE001
        return "UNKNOWN"
    return "CLOSED"


def _yahoo_quote(symbol: str) -> dict:
    df, meta = _yahoo_history(symbol, "5d", "1d")
    if df.empty:
        raise SymbolNotFound(symbol)
    last = df.iloc[-1]
    price = float(meta.get("regularMarketPrice") or last["Close"])
    prev = meta.get("chartPreviousClose") if len(df) < 2 else float(df["Close"].iloc[-2])
    prev = float(prev or price)
    ts = meta.get("regularMarketTime")
    return {
        "symbol": symbol.upper(),
        "name": meta.get("longName") or meta.get("shortName") or symbol.upper(),
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName") or "",
        "currency": meta.get("currency") or "USD",
        "price": price,
        "previousClose": prev,
        "change": price - prev,
        "changePct": (price / prev - 1) * 100 if prev else 0.0,
        "open": float(last["Open"]),
        "dayHigh": float(meta.get("regularMarketDayHigh") or last["High"]),
        "dayLow": float(meta.get("regularMarketDayLow") or last["Low"]),
        "volume": int(meta.get("regularMarketVolume") or last["Volume"] or 0),
        "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
        "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"),
        "marketState": _market_state(meta),
        "time": int(ts) if ts else int(time.time()),
        "source": "yahoo",
    }


_STATE = {"REGULAR": "OPEN", "PRE": "PRE", "PREPRE": "PRE", "POST": "POST", "POSTPOST": "POST", "CLOSED": "CLOSED"}


def _yahoo_quotes_batch(symbols: list[str]) -> list[dict]:
    """All symbols in ONE request to Yahoo's v7 quote endpoint.

    Cloud hosts (Render, etc.) get rate-limited quickly if we fire one request per
    symbol every few seconds, so live quotes always go through this batch call.
    """
    from yfinance.data import YfData

    res = YfData().get_raw_json(
        "https://query1.finance.yahoo.com/v7/finance/quote",
        params={"symbols": ",".join(symbols), "formatted": "false", "lang": "en-US", "region": "US"},
        timeout=10,
    )
    out = []
    for r in (res.get("quoteResponse") or {}).get("result") or []:
        price = r.get("regularMarketPrice")
        if price is None:
            continue
        prev = r.get("regularMarketPreviousClose") or price
        out.append({
            "symbol": r["symbol"].upper(),
            "name": r.get("longName") or r.get("shortName") or r["symbol"],
            "exchange": r.get("fullExchangeName") or r.get("exchange") or "",
            "currency": r.get("currency") or "USD",
            "price": float(price),
            "previousClose": float(prev),
            "change": float(r.get("regularMarketChange", price - prev)),
            "changePct": float(r.get("regularMarketChangePercent", (price / prev - 1) * 100 if prev else 0)),
            "open": float(r.get("regularMarketOpen") or price),
            "dayHigh": float(r.get("regularMarketDayHigh") or price),
            "dayLow": float(r.get("regularMarketDayLow") or price),
            "volume": int(r.get("regularMarketVolume") or 0),
            "fiftyTwoWeekHigh": r.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": r.get("fiftyTwoWeekLow"),
            "marketState": _STATE.get(r.get("marketState", ""), "UNKNOWN"),
            "time": int(r.get("regularMarketTime") or time.time()),
            "source": "yahoo",
        })
    return out


def _yahoo_search(q: str) -> list[dict]:
    res = _yf().Search(q, max_results=10, news_count=0, lists_count=0, raise_errors=False)
    out = []
    for item in res.quotes or []:
        if item.get("quoteType") not in {"EQUITY", "ETF", "INDEX", "MUTUALFUND", "CRYPTOCURRENCY"}:
            continue
        out.append({
            "symbol": item.get("symbol"),
            "name": item.get("longname") or item.get("shortname") or item.get("symbol"),
            "exchange": item.get("exchDisp") or item.get("exchange") or "",
            "type": item.get("quoteType"),
        })
    return out


def _yahoo_news(symbol: str) -> list[dict]:
    items = _yf().Ticker(symbol).get_news(count=12) or []
    out = []
    for a in items:
        c = a.get("content", a)  # new format nests under "content"
        url = (c.get("canonicalUrl") or {}).get("url") or c.get("link") or (c.get("clickThroughUrl") or {}).get("url")
        title = c.get("title")
        if not title or not url:
            continue
        pub = c.get("pubDate") or c.get("displayTime")
        if not pub and a.get("providerPublishTime"):
            pub = datetime.fromtimestamp(a["providerPublishTime"], tz=timezone.utc).isoformat()
        thumb = None
        th = c.get("thumbnail") or {}
        res = th.get("resolutions") or []
        if res:
            thumb = sorted(res, key=lambda r: r.get("width", 0))[0].get("url")
        out.append({
            "title": title,
            "url": url,
            "publisher": (c.get("provider") or {}).get("displayName") or c.get("publisher") or "",
            "publishedAt": pub,
            "summary": c.get("summary") or "",
            "thumbnail": thumb,
        })
    return out


# ---------------------------------------------------------------------------
# Demo implementation (simulated geometric random walk, deterministic per symbol)
# ---------------------------------------------------------------------------
def _seed(symbol: str) -> int:
    return int(hashlib.md5(symbol.upper().encode()).hexdigest()[:8], 16)


def _demo_daily(symbol: str, years: int = 10) -> pd.DataFrame:
    rng = np.random.default_rng(_seed(symbol))
    end = pd.Timestamp.now(tz="UTC").normalize().tz_localize(None)
    idx = pd.bdate_range(end=end, periods=252 * years)
    n = len(idx)
    vol = 0.01 + 0.012 * rng.random()
    drift = 0.0002 + 0.0006 * rng.random()
    # mild volatility clustering + weak momentum so the pipeline has something to learn
    sig = np.empty(n)
    r = np.empty(n)
    sig[0] = vol
    r[0] = 0
    for i in range(1, n):
        sig[i] = 0.94 * sig[i - 1] + 0.06 * vol * (1 + 3 * abs(r[i - 1]) / vol * 0.3)
        r[i] = drift + 0.04 * r[i - 1] + sig[i] * rng.standard_normal()
    start = 20 + 400 * rng.random()
    close = np.exp(np.cumsum(r))
    close = close / close[-1] * start  # end at a realistic price level
    open_ = close * np.exp(rng.normal(0, vol / 3, n))
    high = np.maximum(open_, close) * np.exp(np.abs(rng.normal(0, vol / 2, n)))
    low = np.minimum(open_, close) * np.exp(-np.abs(rng.normal(0, vol / 2, n)))
    volume = (rng.lognormal(16, 0.4, n) * (1 + 20 * np.abs(r))).astype(int)
    return pd.DataFrame({"Open": open_, "High": high, "Low": low, "Close": close, "Volume": volume}, index=idx)


def _demo_history(symbol: str, period: str, interval: str) -> pd.DataFrame:
    daily = _demo_daily(symbol)
    if interval in {"5m", "15m"}:
        rng = np.random.default_rng(_seed(symbol) + int(time.time() // 300))
        days = 1 if period == "1d" else 5
        step = 5 if interval == "5m" else 15
        bars = 78 * 5 // step
        frames = []
        for d in range(days):
            day = daily.index[-days + d]
            base = daily["Open"].iloc[-days + d]
            target = daily["Close"].iloc[-days + d]
            path = np.linspace(base, target, bars) * np.exp(np.cumsum(rng.normal(0, 0.0015, bars)))
            ts = pd.date_range(day + pd.Timedelta(hours=14, minutes=30), periods=bars, freq=f"{step}min")
            frames.append(pd.DataFrame({
                "Open": path, "High": path * 1.001, "Low": path * 0.999, "Close": path,
                "Volume": rng.integers(1e5, 1e6, bars),
            }, index=ts))
        return pd.concat(frames)
    days = {"1mo": 21, "3mo": 63, "6mo": 126, "1y": 252, "5y": 1260, "max": len(daily), "5d": 5}.get(period)
    if period.endswith("y") and period[:-1].isdigit():
        days = int(period[:-1]) * 252
    df = daily.iloc[-(days or len(daily)):]
    if interval == "1wk":
        df = df.resample("W-FRI").agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
    elif interval == "1mo":
        df = df.resample("ME").agg({"Open": "first", "High": "max", "Low": "min", "Close": "last", "Volume": "sum"})
    return df.dropna()


def _demo_quote(symbol: str) -> dict:
    d = _demo_daily(symbol)
    prev = float(d["Close"].iloc[-2])
    wiggle = np.sin(time.time() / 7 + _seed(symbol) % 100) * 0.002 + np.random.normal(0, 0.0007)
    price = float(d["Close"].iloc[-1]) * (1 + wiggle)
    return {
        "symbol": symbol.upper(), "name": f"{symbol.upper()} (demo)", "exchange": "DEMO",
        "currency": "INR" if symbol.upper().endswith(".NS") else "USD",
        "price": price, "previousClose": prev, "change": price - prev,
        "changePct": (price / prev - 1) * 100, "open": float(d["Open"].iloc[-1]),
        "dayHigh": max(price, float(d["High"].iloc[-1])), "dayLow": min(price, float(d["Low"].iloc[-1])),
        "volume": int(d["Volume"].iloc[-1]), "fiftyTwoWeekHigh": float(d["High"].iloc[-252:].max()),
        "fiftyTwoWeekLow": float(d["Low"].iloc[-252:].min()), "marketState": "OPEN",
        "time": int(time.time()), "source": "demo",
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def is_demo() -> bool:
    return config.DATA_SOURCE == "demo"


def history(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    symbol = symbol.upper()
    ttl = 30 if interval.endswith("m") else 600

    def load():
        if is_demo():
            return _demo_history(symbol, period, interval)
        df, _ = _yahoo_history(symbol, period, interval)
        return df

    df = cached(f"hist:{symbol}:{period}:{interval}", ttl, load)
    if df is None or df.empty:
        raise SymbolNotFound(symbol)
    return df


def daily_history(symbol: str, years: int | None = None) -> pd.DataFrame:
    return history(symbol, f"{years or config.HISTORY_YEARS}y", "1d")


def quote(symbol: str) -> dict:
    symbol = symbol.upper()
    got = quotes([symbol])
    if not got:
        raise SymbolNotFound(symbol)
    return got[0]


_batch_off_until = 0.0  # circuit breaker for Yahoo's batch quote endpoint


def quotes(symbols: list[str]) -> list[dict]:
    """Live quotes for many symbols.

    1. Yahoo's batch quote endpoint (one request). Cloud hosts are often refused
       here (it needs a cookie + crumb), so after a failure it's skipped for 10 minutes.
    2. Otherwise each symbol comes from Yahoo's chart endpoint, the same one that
       powers the price chart, which works from cloud hosts.
    3. If that fails too, the latest bar of already-downloaded daily history is used.
    """
    global _batch_off_until
    symbols = list(dict.fromkeys(s.upper() for s in symbols))
    if is_demo():
        return _per_symbol_quotes(symbols)

    now = time.time()
    fresh, missing = {}, []
    with _cache_lock:
        for s in symbols:
            hit = _cache.get(f"quote:{s}")
            if hit and now - hit[0] < 8:
                fresh[s] = hit[1]
            else:
                missing.append(s)

    if missing and now >= _batch_off_until:
        try:
            got = _yahoo_quotes_batch(missing)
            if not got:
                raise RuntimeError("empty response")
            with _cache_lock:
                for q in got:
                    _cache[f"quote:{q['symbol']}"] = (now, q)
                    fresh[q["symbol"]] = q
        except Exception as e:  # noqa: BLE001
            _batch_off_until = now + 600
            log.warning("batch quote endpoint failed (%s); using chart endpoint for 10 min", e)

    still = [s for s in symbols if s not in fresh]
    if still:
        for q in _per_symbol_quotes(still):
            fresh[q["symbol"]] = q
    for s in [s for s in symbols if s not in fresh]:
        q = _quote_from_cached_history(s)
        if q:
            fresh[s] = q
    return [fresh[s] for s in symbols if s in fresh]


def _quote_from_cached_history(symbol: str) -> dict | None:
    """Last resort: build a quote from daily history we already downloaded."""
    with _cache_lock:
        hits = [v for k, v in _cache.items() if k.startswith(f"hist:{symbol}:") and k.endswith(":1d")]
    if not hits:
        return None
    df = max(hits, key=lambda h: h[0])[1]
    if df is None or len(df) < 2:
        return None
    last, prev = df.iloc[-1], float(df["Close"].iloc[-2])
    price = float(last["Close"])
    return {
        "symbol": symbol, "name": symbol, "exchange": "", "currency": "INR" if symbol.endswith((".NS", ".BO")) else "USD",
        "price": price, "previousClose": prev, "change": price - prev, "changePct": (price / prev - 1) * 100,
        "open": float(last["Open"]), "dayHigh": float(last["High"]), "dayLow": float(last["Low"]),
        "volume": int(last["Volume"] or 0), "fiftyTwoWeekHigh": float(df["High"].iloc[-252:].max()),
        "fiftyTwoWeekLow": float(df["Low"].iloc[-252:].min()), "marketState": "UNKNOWN",
        "time": int(time.time()), "source": "history",
    }


def _per_symbol_quotes(symbols: list[str]) -> list[dict]:
    def safe(s):
        try:
            return cached(f"quote:{s}", 8, lambda: _demo_quote(s) if is_demo() else _yahoo_quote(s))
        except Exception as e:  # noqa: BLE001
            log.warning("quote failed for %s: %s", s, e)
            return None

    return [q for q in _pool.map(safe, symbols) if q]


def search(q: str) -> list[dict]:
    if is_demo():
        pool = config.TRAINING_UNIVERSE
        return [{"symbol": s, "name": f"{s} (demo)", "exchange": "DEMO", "type": "EQUITY"}
                for s in pool if q.upper() in s][:10]
    return cached(f"search:{q.lower()}", 3600, lambda: _yahoo_search(q))


def news(symbol: str) -> list[dict]:
    if is_demo():
        return []
    return cached(f"news:{symbol.upper()}", 600, lambda: _yahoo_news(symbol.upper()))
