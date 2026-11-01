"""LightGBM direction model: training, walk-forward evaluation and explanations.

Explanations use LightGBM's built-in TreeSHAP (`pred_contrib=True`), which gives
exact SHAP values for tree models without the heavy `shap` package.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from datetime import datetime, timezone

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score

from . import config, data
from .features import FEATURE_LABELS, FEATURES, add_indicators, format_feature

log = logging.getLogger(__name__)

MODEL_PATH = config.MODEL_DIR / "model.joblib"
METRICS_PATH = config.MODEL_DIR / "metrics.json"

PARAMS = dict(
    n_estimators=400,
    learning_rate=0.02,
    num_leaves=15,
    max_depth=5,
    min_child_samples=300,
    subsample=0.8,
    subsample_freq=1,
    colsample_bytree=0.7,
    reg_lambda=5.0,
    verbose=-1,
)


class TrainingState:
    def __init__(self):
        self.state = "idle"  # idle | training | ready | error
        self.message = ""
        self.progress = 0.0
        self.lock = threading.Lock()

    def set(self, state=None, message=None, progress=None):
        with self.lock:
            if state is not None:
                self.state = state
            if message is not None:
                self.message = message
            if progress is not None:
                self.progress = progress

    def as_dict(self):
        return {"state": self.state, "message": self.message, "progress": round(self.progress, 3)}


status = TrainingState()
_model: lgb.LGBMClassifier | None = None
_metrics: dict | None = None


# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
def build_dataset(symbols: list[str]) -> pd.DataFrame:
    frames = []
    for i, s in enumerate(symbols):
        status.set(message=f"Downloading {s} ({i + 1}/{len(symbols)})", progress=0.4 * i / len(symbols))
        try:
            df = add_indicators(data.daily_history(s))
        except Exception as e:  # noqa: BLE001
            log.warning("skipping %s: %s", s, e)
            continue
        df = df.dropna(subset=FEATURES + ["target"])
        if len(df) < 300:
            continue
        df = df[FEATURES + ["target", "next_return"]].copy()
        df["symbol"] = s
        df["date"] = df.index.tz_localize(None) if df.index.tz is not None else df.index
        frames.append(df.reset_index(drop=True))
    if not frames:
        raise RuntimeError("No training data could be downloaded. Check your internet connection / Yahoo access.")
    return pd.concat(frames, ignore_index=True).sort_values(["date", "symbol"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Walk-forward evaluation
# ---------------------------------------------------------------------------
def _equity_curve(dates: pd.Series, ret: np.ndarray, pos: np.ndarray) -> list[dict]:
    strat = np.cumprod(1 + ret * pos)
    hold = np.cumprod(1 + ret)
    s = pd.DataFrame({"strategy": strat, "buyHold": hold}, index=pd.to_datetime(dates.values))
    s = s.resample("W-FRI").last().dropna()
    return [{"date": d.strftime("%Y-%m-%d"), "strategy": round(float(r.strategy), 4), "buyHold": round(float(r.buyHold), 4)}
            for d, r in s.iterrows()]


def walk_forward(ds: pd.DataFrame, n_folds: int = 6, test_years: float = 3.0) -> tuple[pd.DataFrame, dict]:
    dates = np.sort(ds["date"].unique())
    test_start = pd.Timestamp(dates[-1]) - pd.DateOffset(days=int(365 * test_years))
    test_dates = dates[dates >= np.datetime64(test_start)]
    fold_edges = np.array_split(test_dates, n_folds)
    oos = []
    for k, fold in enumerate(fold_edges):
        status.set(message=f"Walk-forward fold {k + 1}/{n_folds}", progress=0.4 + 0.45 * k / n_folds)
        f0, f1 = fold[0], fold[-1]
        # 1-day embargo: the last training label uses the next close, which must stay before the fold.
        prior = dates[dates < f0]
        if len(prior) < 2:
            continue
        train = ds[ds["date"] < prior[-1]]
        test = ds[(ds["date"] >= f0) & (ds["date"] <= f1)]
        m = lgb.LGBMClassifier(**PARAMS).fit(train[FEATURES], train["target"])
        t = test[["date", "symbol", "target", "next_return"]].copy()
        t["p_up"] = m.predict_proba(test[FEATURES])[:, 1]
        oos.append(t)
    oos = pd.concat(oos, ignore_index=True)

    y, p = oos["target"].values, oos["p_up"].values
    pred = (p > 0.5).astype(int)
    up_rate = float(y.mean())
    conf = np.abs(p - 0.5)
    cut = np.quantile(conf, 0.8)
    hi = conf >= cut

    overall = {
        "accuracy": float(accuracy_score(y, pred)),
        "baseline": max(up_rate, 1 - up_rate),
        "baselineLabel": "always predict UP" if up_rate >= 0.5 else "always predict DOWN",
        "auc": float(roc_auc_score(y, p)),
        "logLoss": float(log_loss(y, p)),
        "samples": int(len(oos)),
        "highConviction": {
            "accuracy": float(accuracy_score(y[hi], pred[hi])),
            "share": float(hi.mean()),
            "threshold": float(cut),
        },
        "testStart": pd.Timestamp(test_dates[0]).strftime("%Y-%m-%d"),
        "testEnd": pd.Timestamp(test_dates[-1]).strftime("%Y-%m-%d"),
        "folds": n_folds,
    }

    per_symbol = {}
    for s, g in oos.groupby("symbol"):
        g = g.sort_values("date")
        ys, ps = g["target"].values, g["p_up"].values
        ur = float(ys.mean())
        ret = g["next_return"].values
        pos = (ps > 0.5).astype(float)
        strat_total = float(np.prod(1 + ret * pos) - 1)
        hold_total = float(np.prod(1 + ret) - 1)
        per_symbol[s] = {
            "accuracy": float(accuracy_score(ys, (ps > 0.5).astype(int))),
            "baseline": max(ur, 1 - ur),
            "samples": int(len(g)),
            "strategyReturn": strat_total,
            "buyHoldReturn": hold_total,
            "timeInMarket": float(pos.mean()),
            "equity": _equity_curve(g["date"], ret, pos),
        }
    return oos, {"overall": overall, "perSymbol": per_symbol}


# ---------------------------------------------------------------------------
# Train / load
# ---------------------------------------------------------------------------
def train(symbols: list[str] | None = None) -> dict:
    global _model, _metrics
    symbols = symbols or config.TRAINING_UNIVERSE
    status.set("training", "Starting", 0.0)
    t0 = time.time()
    try:
        ds = build_dataset(symbols)
        _, wf = walk_forward(ds)
        status.set(message="Fitting final model on all data", progress=0.9)
        model = lgb.LGBMClassifier(**PARAMS).fit(ds[FEATURES], ds["target"])
        gain = model.booster_.feature_importance(importance_type="gain")
        gain = gain / gain.sum()
        metrics = {
            **wf,
            "trainedAt": datetime.now(timezone.utc).isoformat(),
            "trainSeconds": round(time.time() - t0, 1),
            "dataSource": config.DATA_SOURCE,
            "universe": sorted(ds["symbol"].unique().tolist()),
            "rows": int(len(ds)),
            "dataStart": ds["date"].min().strftime("%Y-%m-%d"),
            "dataEnd": ds["date"].max().strftime("%Y-%m-%d"),
            "baseRate": float(ds["target"].mean()),
            "featureImportance": sorted(
                [{"feature": f, "label": FEATURE_LABELS[f], "importance": float(g)} for f, g in zip(FEATURES, gain)],
                key=lambda x: -x["importance"],
            ),
            "model": "LightGBM gradient-boosted trees",
            "params": {k: v for k, v in PARAMS.items() if k != "verbose"},
        }
        joblib.dump(model, MODEL_PATH)
        METRICS_PATH.write_text(json.dumps(metrics, indent=1))
        _model, _metrics = model, metrics
        status.set("ready", f"Trained on {len(ds):,} rows in {metrics['trainSeconds']}s", 1.0)
        return metrics
    except Exception as e:  # noqa: BLE001
        log.exception("training failed")
        status.set("error", str(e), 0.0)
        raise


def load() -> bool:
    global _model, _metrics
    if MODEL_PATH.exists() and METRICS_PATH.exists():
        _model = joblib.load(MODEL_PATH)
        _metrics = json.loads(METRICS_PATH.read_text())
        status.set("ready", f"Loaded model trained {_metrics.get('trainedAt', '')[:10]}", 1.0)
        return True
    return False


def train_in_background():
    if status.state == "training":
        return
    threading.Thread(target=lambda: _safe_train(), daemon=True).start()


def _safe_train():
    try:
        train()
    except Exception:  # noqa: BLE001
        pass


def ready() -> bool:
    return _model is not None


def metrics() -> dict | None:
    return _metrics


# ---------------------------------------------------------------------------
# Predict + explain
# ---------------------------------------------------------------------------
def _sigmoid(x):
    return 1 / (1 + np.exp(-x))


def predict_explain(feat_row: pd.DataFrame) -> dict:
    """feat_row: single-row DataFrame with FEATURES columns."""
    assert _model is not None
    X = feat_row[FEATURES].astype(float)
    p_up = float(_model.predict_proba(X)[0, 1])
    contrib = _model.predict(X, pred_contrib=True)[0]  # log-odds; last element is the bias
    bias, phi = float(contrib[-1]), contrib[:-1]

    order = np.argsort(-np.abs(phi))
    top_n = 8
    steps = []
    logit = bias
    base_p = float(_sigmoid(bias))
    for i in order[:top_n]:
        before = _sigmoid(logit)
        logit += phi[i]
        after = _sigmoid(logit)
        f = FEATURES[i]
        val = float(X.iloc[0][f])
        steps.append({
            "feature": f,
            "label": FEATURE_LABELS[f],
            "value": val,
            "display": format_feature(f, val),
            "shap": float(phi[i]),
            "impact": float(after - before),  # change in probability (0-1)
            "direction": "up" if phi[i] > 0 else "down",
            "sentence": _sentence(f, val, phi[i]),
        })
    rest = phi[order[top_n:]].sum()
    if len(order) > top_n:
        before = _sigmoid(logit)
        logit += rest
        steps.append({
            "feature": "_other", "label": f"{len(order) - top_n} other features", "value": None,
            "display": "", "shap": float(rest), "impact": float(_sigmoid(logit) - before),
            "direction": "up" if rest > 0 else "down", "sentence": "",
        })
    return {"pUp": p_up, "baseProbability": base_p, "contributions": steps}


def _sentence(f: str, v: float, s: float) -> str:
    push = "toward UP" if s > 0 else "toward DOWN"
    label = FEATURE_LABELS[f]
    return f"{label} is {format_feature(f, v)}, which pushes the model {push}."


def analyse(symbol: str) -> dict:
    from . import agents

    raw = data.daily_history(symbol, years=2)
    df = add_indicators(raw)
    feats = df.dropna(subset=FEATURES)
    if feats.empty:
        raise ValueError("Not enough price history to compute indicators (need ~60 trading days).")
    last = feats.iloc[-1]
    hist = df.loc[: feats.index[-1]]

    ag = [agents.technical_agent(last), agents.trend_agent(last), agents.risk_agent(hist)]
    out: dict = {"symbol": symbol.upper(), "asOf": feats.index[-1].strftime("%Y-%m-%d")}

    if ready():
        exp = predict_explain(feats.iloc[[-1]])
        ag.insert(0, agents.model_agent(exp["pUp"], _metrics.get("baseRate", 0.5)))
        out["prediction"] = {
            "direction": "UP" if exp["pUp"] >= 0.5 else "DOWN",
            "pUp": exp["pUp"],
            "confidence": max(exp["pUp"], 1 - exp["pUp"]),
            "highConviction": abs(exp["pUp"] - 0.5) >= _metrics["overall"]["highConviction"]["threshold"],
        }
        out["explanation"] = exp
        ps = _metrics["perSymbol"].get(symbol.upper())
        out["track"] = ps
        out["inUniverse"] = ps is not None
    else:
        out["prediction"] = None
        out["explanation"] = None
        out["track"] = None
        out["inUniverse"] = False

    out["agents"] = ag
    out["fusion"] = agents.fuse(ag)
    out["indicators"] = {
        "rsi": float(last["rsi"]), "macd": float(last["macd"]), "macdSignal": float(last["macd_signal"]),
        "sma20": float(last["sma20"]), "sma50": float(last["sma50"]),
        "sma200": None if pd.isna(last["sma200"]) else float(last["sma200"]),
        "atr": float(last["atr"]), "close": float(last["Close"]),
    }
    return out
