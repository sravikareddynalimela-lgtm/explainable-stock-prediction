"""Technical indicators and scale-free model features.

All features are ratios or percentages so one model can learn across stocks
priced at $20 or ₹3,000 alike (the old model fed raw SMA prices, which doesn't
transfer between stocks).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURES: list[str] = [
    "rsi_14",
    "macd_pct",
    "macd_hist_pct",
    "dist_sma5",
    "dist_sma20",
    "dist_sma50",
    "sma5_vs_sma20",
    "sma20_vs_sma50",
    "ret_1",
    "ret_5",
    "ret_10",
    "ret_20",
    "vol_20",
    "vol_ratio",
    "atr_pct",
    "bb_pctb",
    "bb_width",
    "volume_ratio",
    "dist_52w_high",
    "stoch_k",
]

FEATURE_LABELS: dict[str, str] = {
    "rsi_14": "RSI (14-day)",
    "macd_pct": "MACD",
    "macd_hist_pct": "MACD histogram",
    "dist_sma5": "Price vs 5-day avg",
    "dist_sma20": "Price vs 20-day avg",
    "dist_sma50": "Price vs 50-day avg",
    "sma5_vs_sma20": "5-day vs 20-day avg",
    "sma20_vs_sma50": "20-day vs 50-day avg",
    "ret_1": "1-day return",
    "ret_5": "5-day return",
    "ret_10": "10-day return",
    "ret_20": "20-day return",
    "vol_20": "20-day volatility",
    "vol_ratio": "Short vs long volatility",
    "atr_pct": "Average true range",
    "bb_pctb": "Bollinger %B",
    "bb_width": "Bollinger band width",
    "volume_ratio": "Volume vs 20-day avg",
    "dist_52w_high": "Distance from 52-week high",
    "stoch_k": "Stochastic %K",
}

# How to format a feature value for people: "pct" values are fractions shown as %.
FEATURE_FORMAT: dict[str, str] = {
    "rsi_14": "num", "stoch_k": "num", "bb_pctb": "num", "vol_ratio": "x", "volume_ratio": "x",
}


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / n, adjust=False, min_periods=n).mean()
    rs = gain / loss.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(100.0).where(loss.notna())


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Add raw indicators (for charts/agents) and normalised features (for the model)."""
    d = df.copy()
    c, h, l, v = d["Close"], d["High"], d["Low"], d["Volume"].astype(float)

    d["sma5"] = c.rolling(5).mean()
    d["sma20"] = c.rolling(20).mean()
    d["sma50"] = c.rolling(50).mean()
    d["sma200"] = c.rolling(200).mean()
    d["rsi"] = rsi(c, 14)

    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    d["macd"] = ema12 - ema26
    d["macd_signal"] = d["macd"].ewm(span=9, adjust=False).mean()
    d["macd_hist"] = d["macd"] - d["macd_signal"]

    std20 = c.rolling(20).std()
    d["bb_upper"] = d["sma20"] + 2 * std20
    d["bb_lower"] = d["sma20"] - 2 * std20

    prev_c = c.shift(1)
    tr = pd.concat([h - l, (h - prev_c).abs(), (l - prev_c).abs()], axis=1).max(axis=1)
    d["atr"] = tr.ewm(alpha=1 / 14, adjust=False, min_periods=14).mean()

    ret = c.pct_change()
    d["daily_return"] = ret

    # ---- model features ----
    d["rsi_14"] = d["rsi"]
    d["macd_pct"] = d["macd"] / c
    d["macd_hist_pct"] = d["macd_hist"] / c
    d["dist_sma5"] = c / d["sma5"] - 1
    d["dist_sma20"] = c / d["sma20"] - 1
    d["dist_sma50"] = c / d["sma50"] - 1
    d["sma5_vs_sma20"] = d["sma5"] / d["sma20"] - 1
    d["sma20_vs_sma50"] = d["sma20"] / d["sma50"] - 1
    for n in (1, 5, 10, 20):
        d[f"ret_{n}"] = c.pct_change(n)
    d["vol_20"] = ret.rolling(20).std()
    d["vol_ratio"] = ret.rolling(5).std() / d["vol_20"]
    d["atr_pct"] = d["atr"] / c
    band = (d["bb_upper"] - d["bb_lower"]).replace(0, np.nan)
    d["bb_pctb"] = (c - d["bb_lower"]) / band
    d["bb_width"] = band / d["sma20"]
    d["volume_ratio"] = v / v.rolling(20).mean().replace(0, np.nan)
    d["dist_52w_high"] = c / c.rolling(252, min_periods=60).max() - 1
    lo14, hi14 = l.rolling(14).min(), h.rolling(14).max()
    d["stoch_k"] = 100 * (c - lo14) / (hi14 - lo14).replace(0, np.nan)

    # ---- target: does the next session close higher? ----
    d["next_return"] = c.shift(-1) / c - 1
    d["target"] = (d["next_return"] > 0).astype(float).where(d["next_return"].notna())

    d[FEATURES] = d[FEATURES].replace([np.inf, -np.inf], np.nan)
    return d


def format_feature(name: str, value: float) -> str:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return "–"
    kind = FEATURE_FORMAT.get(name, "pct")
    if kind == "num":
        return f"{value:.2f}" if name == "bb_pctb" else f"{value:.1f}"
    if kind == "x":
        return f"{value:.2f}×"
    return f"{value * 100:+.2f}%"
