"""Rule-based analysis agents and the fusion step.

Each directional agent returns a score in [-1, 1] (negative = bearish) plus
plain-English reasons. The risk agent is non-directional: it scales how much
conviction the final signal is allowed to have.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _clip(x: float) -> float:
    return float(max(-1.0, min(1.0, x)))


def _stance(score: float, band: float = 0.15) -> str:
    return "BULLISH" if score > band else "BEARISH" if score < -band else "NEUTRAL"


def technical_agent(row: pd.Series) -> dict:
    reasons, parts = [], []
    r = row["rsi"]
    if r >= 70:
        parts.append(-0.6)
        reasons.append(f"RSI {r:.0f} is overbought (above 70), so a pullback is more likely.")
    elif r <= 30:
        parts.append(0.6)
        reasons.append(f"RSI {r:.0f} is oversold (below 30), so a rebound is more likely.")
    else:
        parts.append((r - 50) / 50)
        reasons.append(f"RSI {r:.0f} is in the normal range, leaning {'bullish' if r > 50 else 'bearish'}.")

    if row["macd_hist"] > 0:
        parts.append(0.7)
        reasons.append("MACD is above its signal line, so momentum is turning up.")
    else:
        parts.append(-0.7)
        reasons.append("MACD is below its signal line, so momentum is turning down.")

    pb = row["bb_pctb"]
    if pb > 1:
        parts.append(-0.4)
        reasons.append("Price is above the upper Bollinger band (stretched).")
    elif pb < 0:
        parts.append(0.4)
        reasons.append("Price is below the lower Bollinger band (stretched to the downside).")

    if row["volume_ratio"] > 1.5:
        direction = 1 if row["ret_1"] > 0 else -1
        parts.append(0.3 * direction)
        reasons.append(f"Volume is {row['volume_ratio']:.1f}× normal, confirming today's {'gain' if direction > 0 else 'drop'}.")

    score = _clip(float(np.mean(parts)))
    return {
        "id": "technical", "name": "Technical Agent", "score": score, "stance": _stance(score),
        "summary": "Momentum oscillators: RSI, MACD, Bollinger bands and volume.",
        "reasons": reasons,
        "metrics": [
            {"label": "RSI 14", "value": f"{r:.1f}"},
            {"label": "MACD hist", "value": f"{row['macd_hist']:.3f}"},
            {"label": "Bollinger %B", "value": f"{pb:.2f}"},
            {"label": "Volume", "value": f"{row['volume_ratio']:.2f}×"},
        ],
    }


def trend_agent(row: pd.Series) -> dict:
    reasons, parts = [], []
    c = row["Close"]
    for name, col, w in (("20-day", "sma20", 0.5), ("50-day", "sma50", 0.6), ("200-day", "sma200", 0.8)):
        val = row.get(col)
        if val is None or pd.isna(val):
            continue
        above = c > val
        parts.append(w if above else -w)
        reasons.append(f"Price is {'above' if above else 'below'} its {name} average ({(c / val - 1) * 100:+.1f}%).")

    if row["sma5"] > row["sma20"]:
        parts.append(0.5)
        reasons.append("Short-term average is above the 20-day, so the near-term trend is up.")
    else:
        parts.append(-0.5)
        reasons.append("Short-term average is below the 20-day, so the near-term trend is down.")

    r20 = row["ret_20"]
    parts.append(_clip(r20 / 0.1))
    reasons.append(f"The stock moved {r20 * 100:+.1f}% over the last 20 trading days.")

    score = _clip(float(np.mean(parts)))
    return {
        "id": "trend", "name": "Trend Agent", "score": score, "stance": _stance(score),
        "summary": "Moving-average structure and recent returns.",
        "reasons": reasons,
        "metrics": [
            {"label": "vs SMA 20", "value": f"{row['dist_sma20'] * 100:+.1f}%"},
            {"label": "vs SMA 50", "value": f"{row['dist_sma50'] * 100:+.1f}%"},
            {"label": "5-day return", "value": f"{row['ret_5'] * 100:+.1f}%"},
            {"label": "20-day return", "value": f"{r20 * 100:+.1f}%"},
        ],
    }


def risk_agent(df: pd.DataFrame) -> dict:
    row = df.iloc[-1]
    vol_hist = df["vol_20"].dropna().iloc[-252:]
    pct = float((vol_hist < row["vol_20"]).mean() * 100) if len(vol_hist) else 50.0
    annual = row["vol_20"] * np.sqrt(252) * 100
    if pct >= 80:
        level, damp = "HIGH", 0.6
    elif pct >= 50:
        level, damp = "ELEVATED", 0.85
    else:
        level, damp = "LOW", 1.0
    dd = row["dist_52w_high"] * 100
    reasons = [
        f"Annualised volatility is {annual:.0f}%, higher than {pct:.0f}% of the past year.",
        f"Typical daily range (ATR) is {row['atr_pct'] * 100:.1f}% of the price.",
        f"The stock is {abs(dd):.1f}% below its 52-week high." if dd < -0.5 else "The stock is trading near its 52-week high.",
    ]
    if level != "LOW":
        reasons.append(f"Risk is {level.lower()}, so the final signal's conviction is scaled to {damp:.0%}.")
    return {
        "id": "risk", "name": "Risk Agent", "score": 0.0, "stance": level,
        "summary": "Volatility regime and drawdown. Doesn't vote on direction, but tempers conviction.",
        "reasons": reasons, "dampener": damp,
        "metrics": [
            {"label": "Volatility (ann.)", "value": f"{annual:.0f}%"},
            {"label": "Vol percentile", "value": f"{pct:.0f}th"},
            {"label": "ATR", "value": f"{row['atr_pct'] * 100:.2f}%"},
            {"label": "From 52w high", "value": f"{dd:.1f}%"},
        ],
    }


def model_agent(p_up: float, base_rate: float) -> dict:
    edge = p_up - 0.5
    # Probabilities from a next-day model cluster tightly around 50%, so scale the edge up.
    score = _clip(edge / 0.1)
    reasons = [
        f"The gradient-boosted model gives a {p_up * 100:.1f}% chance the next close is higher.",
        f"For comparison, {base_rate * 100:.1f}% of days closed higher in the training data.",
    ]
    return {
        "id": "model", "name": "ML Model", "score": score, "stance": _stance(score),
        "summary": "LightGBM trained on 20 features across 30 stocks.",
        "reasons": reasons,
        "metrics": [
            {"label": "P(up)", "value": f"{p_up * 100:.1f}%"},
            {"label": "P(down)", "value": f"{(1 - p_up) * 100:.1f}%"},
        ],
    }


WEIGHTS = {"model": 0.5, "technical": 0.25, "trend": 0.25}


def fuse(agents: list[dict]) -> dict:
    by_id = {a["id"]: a for a in agents}
    raw = sum(WEIGHTS[k] * by_id[k]["score"] for k in WEIGHTS if k in by_id)
    damp = by_id.get("risk", {}).get("dampener", 1.0)
    score = raw * damp
    if score >= 0.2:
        signal = "BUY"
    elif score <= -0.2:
        signal = "SELL"
    else:
        signal = "HOLD"
    agree = sum(1 for k in WEIGHTS if k in by_id and np.sign(by_id[k]["score"]) == np.sign(raw) and abs(by_id[k]["score"]) > 0.15)
    return {
        "signal": signal,
        "score": float(score),
        "rawScore": float(raw),
        "dampener": damp,
        "agreement": f"{agree} of {len(WEIGHTS)}",
        "weights": WEIGHTS,
        "explanation": (
            f"Weighted vote of the model (50%), technical (25%) and trend (25%) agents gives {raw:+.2f}"
            + (f", scaled by the risk agent to {score:+.2f}" if damp < 1 else "")
            + f". Above +0.20 is BUY, below −0.20 is SELL, anything between is HOLD."
        ),
    }
