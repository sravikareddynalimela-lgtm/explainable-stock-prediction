"""FastAPI app: REST endpoints + a Server-Sent Events stream of live quotes."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse

from . import auth, config, data, model
from .features import add_indicators

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not model.load():
        if config.AUTO_TRAIN:
            log.info("No saved model found, training in the background")
            model.train_in_background()
        else:
            log.warning("No saved model and AUTO_TRAIN=0; run `python train.py`")
    yield


app = FastAPI(title="Explainable Stock Prediction API", version="2.0.0", lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _clean_symbol(symbol: str) -> str:
    s = symbol.strip().upper()
    if not s or len(s) > 20 or not all(ch.isalnum() or ch in ".-^=" for ch in s):
        raise HTTPException(400, "Invalid symbol")
    return s


def _nan_to_none(x):
    return None if x is None or (isinstance(x, float) and (np.isnan(x) or np.isinf(x))) else x


def _clean(o):
    """Recursively replace NaN/inf (invalid in JSON) with None and numpy scalars with Python ones."""
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, np.generic):
        o = o.item()
    if isinstance(o, float) and (np.isnan(o) or np.isinf(o)):
        return None
    return o


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "dataSource": config.DATA_SOURCE,
        "authEnabled": auth.AUTH_ENABLED,
        "model": model.status.as_dict(),
        "trainedAt": (model.metrics() or {}).get("trainedAt"),
        "time": int(time.time()),
    }


@app.get("/api/config")
def get_config():
    return {"watchlist": config.DEFAULT_WATCHLIST, "universe": config.TRAINING_UNIVERSE,
            "indices": [{"symbol": s, "name": n} for s, n in config.MARKET_INDICES],
            "streamInterval": config.STREAM_INTERVAL, "dataSource": config.DATA_SOURCE, "authEnabled": auth.AUTH_ENABLED}


# Everything on this router needs a logged-in Supabase user.
api = APIRouter(prefix="/api", dependencies=[Depends(auth.current_user)])


@app.get("/api/public/markets")
def public_markets():
    """Major indices, shown on the login page ticker. No login needed."""
    return data.quotes([s for s, _ in config.MARKET_INDICES])


@api.get("/me")
def me(user: dict = Depends(auth.current_user)):
    meta = user.get("user_metadata") or {}
    return {"id": user.get("sub"), "email": user.get("email"), "name": meta.get("full_name") or meta.get("name")}


@api.get("/search")
def search(q: str = Query(..., min_length=1, max_length=40)):
    try:
        return data.search(q)
    except Exception as e:  # noqa: BLE001
        log.warning("search failed: %s", e)
        return []


@api.get("/quote/{symbol}")
def get_quote(symbol: str):
    s = _clean_symbol(symbol)
    try:
        return data.quote(s)
    except data.SymbolNotFound:
        raise HTTPException(404, f"No market data for {s}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Data provider error: {e}")


@api.get("/quotes")
def get_quotes(symbols: str = Query(..., max_length=400)):
    syms = [_clean_symbol(s) for s in symbols.split(",") if s.strip()][:30]
    return data.quotes(syms)


@api.get("/history/{symbol}")
def get_history(symbol: str, range: str = "6mo"):  # noqa: A002
    s = _clean_symbol(symbol)
    if range not in data.RANGES:
        raise HTTPException(400, f"range must be one of {list(data.RANGES)}")
    period, interval = data.RANGES[range]
    try:
        if interval == "1d":
            # compute indicators on a longer window so averages are populated from the first bar
            full = add_indicators(data.daily_history(s))  # shares the cache with /analysis
            n = {"1mo": 22, "3mo": 64, "6mo": 127, "1y": 253}[range]
            df = full.iloc[-n:]
        else:
            df = add_indicators(data.history(s, period, interval))
    except data.SymbolNotFound:
        raise HTTPException(404, f"No market data for {s}")
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Data provider error: {e}")

    idx = df.index
    if getattr(idx, "tz", None) is not None:
        idx = idx.tz_convert("UTC").tz_localize(None)
    times = ((idx - pd.Timestamp("1970-01-01")) // pd.Timedelta(seconds=1)).astype(int).tolist()

    def series(col):
        return [{"time": t, "value": float(v)} for t, v in zip(times, df[col].values) if not pd.isna(v)]

    candles = [
        {"time": t, "open": float(o), "high": float(h), "low": float(lo), "close": float(c), "volume": float(v)}
        for t, o, h, lo, c, v in zip(times, df.Open, df.High, df.Low, df.Close, df.Volume)
    ]
    return {
        "symbol": s, "range": range, "interval": interval, "intraday": interval.endswith("m"),
        "candles": candles, "sma20": series("sma20"), "sma50": series("sma50"),
        "bbUpper": series("bb_upper"), "bbLower": series("bb_lower"), "rsi": series("rsi"),
    }


@api.get("/analysis/{symbol}")
def get_analysis(symbol: str):
    s = _clean_symbol(symbol)
    try:
        res = model.analyse(s)
    except data.SymbolNotFound:
        raise HTTPException(404, f"No market data for {s}")
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:  # noqa: BLE001
        log.exception("analysis failed")
        raise HTTPException(502, f"Analysis failed: {e}")
    res["modelStatus"] = model.status.as_dict()
    return _clean(res)


@api.get("/news/{symbol}")
def get_news(symbol: str):
    s = _clean_symbol(symbol)
    try:
        return data.news(s)
    except Exception as e:  # noqa: BLE001
        log.warning("news failed for %s: %s", s, e)
        return []


@api.get("/model")
def get_model():
    m = model.metrics()
    if not m:
        return {"status": model.status.as_dict(), "metrics": None}
    slim = {k: v for k, v in m.items() if k != "perSymbol"}
    slim["perSymbol"] = {s: {k: v for k, v in d.items() if k != "equity"} for s, d in m["perSymbol"].items()}
    return {"status": model.status.as_dict(), "metrics": slim}


@api.post("/model/retrain")
def retrain(user: dict = Depends(auth.current_user)):
    if auth.AUTH_ENABLED and (user.get("email") or "").lower() not in config.ADMIN_EMAILS:
        raise HTTPException(403, "Only admins can retrain the model.")
    model.train_in_background()
    return model.status.as_dict()


@api.get("/stream")
async def stream(request: Request, symbols: str = Query(..., max_length=400)):
    """Server-Sent Events: pushes fresh quotes every STREAM_INTERVAL seconds."""
    syms = [_clean_symbol(s) for s in symbols.split(",") if s.strip()][:30]
    loop = asyncio.get_running_loop()

    async def gen():
        yield f"retry: 3000\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                qs = await loop.run_in_executor(None, data.quotes, syms)
                yield f"event: quotes\ndata: {json.dumps(qs, default=_nan_to_none)}\n\n"
            except Exception as e:  # noqa: BLE001
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
            await asyncio.sleep(config.STREAM_INTERVAL)

    headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)


app.include_router(api)
