"""Analysis agents and the fusion step.

Directional agents (ML model, Technical, Historical) return a score in [-1, 1]
(negative = bearish) plus plain-English reasons. The Volatility agent doesn't
vote on direction; it scales how much conviction the final signal may have.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _clip(x: float) -> float:
    return float(max(-1.0, min(1.0, x)))


def _stance(score: float, band: float = 0.15) -> str:
    return "BULLISH" if score > band else "BEARISH" if score < -band else "NEUTRAL"


def _direction(score: float, band: float = 0.15) -> str:
    return "UP" if score > band else "DOWN" if score < -band else "HOLD"


# ---------------------------------------------------------------------------
# Technical agent: RSI, MACD, SMA 20, Bollinger, volume
# ---------------------------------------------------------------------------
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

    above20 = row["Close"] > row["sma20"]
    parts.append(0.4 if above20 else -0.4)
    reasons.append(f"Price is {'above' if above20 else 'below'} its 20-day average ({row['dist_sma20'] * 100:+.1f}%).")

    pb = row["bb_pctb"]
    if pb > 1:
        parts.append(-0.4)
        reasons.append("Price is above the upper Bollinger band (stretched).")
    elif pb < 0:
        parts.append(0.4)
        reasons.append("Price is below the lower Bollinger band (stretched to the downside).")

    if row["volume_ratio"] > 1.5:
        d = 1 if row["ret_1"] > 0 else -1
        parts.append(0.3 * d)
        reasons.append(f"Volume is {row['volume_ratio']:.1f}× normal, confirming today's {'gain' if d > 0 else 'drop'}.")

    score = _clip(float(np.mean(parts)))
    return {
        "id": "technical", "name": "Technical Agent", "score": score, "stance": _stance(score), "vote": _direction(score),
        "summary": "Momentum and price position: RSI, MACD, 20-day average, Bollinger bands, volume.",
        "reasons": reasons,
        "metrics": [
            {"label": "RSI 14", "value": f"{r:.1f}"},
            {"label": "MACD", "value": f"{row['macd']:.3f}"},
            {"label": "SMA 20", "value": f"{row['sma20']:,.2f}"},
            {"label": "Bollinger %B", "value": f"{pb:.2f}"},
        ],
    }


# ---------------------------------------------------------------------------
# Historical agent: the original SMA5/SMA20 + 5-day-return rules, plus
# "historical analogs": how this stock behaved after past days like today.
# ---------------------------------------------------------------------------
def _analogs(df: pd.DataFrame) -> dict | None:
    hist = df.iloc[:-1].dropna(subset=["rsi", "sma5", "sma20", "ret_5", "vol_20", "next_return"])
    if len(hist) < 250:
        return None
    t = df.iloc[-1]
    trend = hist["sma5"] > hist["sma20"]
    mom = np.sign(hist["ret_5"])
    base = (trend == (t["sma5"] > t["sma20"])) & (mom == np.sign(t["ret_5"]))
    for rsi_band, use_vol in ((5, True), (5, False), (10, False)):
        m = base & ((hist["rsi"] - t["rsi"]).abs() <= rsi_band)
        if use_vol:
            m &= (hist["vol_20"] / t["vol_20"]).between(0.7, 1.4)
        sub = hist[m]
        if len(sub) >= 30:
            break
    if len(sub) < 15:
        return None
    up = float((sub["next_return"] > 0).mean())
    base_up = float((hist["next_return"] > 0).mean())
    return {
        "matches": int(len(sub)), "upRate": up, "baseUpRate": base_up,
        "avgNextReturn": float(sub["next_return"].mean()),
        "years": round(len(hist) / 252, 1),
        "rsiBand": rsi_band, "volMatched": use_vol,
        "lastMatch": sub.index[-1].strftime("%Y-%m-%d"),
    }


def historical_agent(df: pd.DataFrame) -> dict:
    row = df.iloc[-1]
    reasons, parts = [], []

    up_trend = row["sma5"] > row["sma20"]
    parts.append(0.6 if up_trend else -0.6)
    reasons.append(f"5-day average is {'above' if up_trend else 'below'} the 20-day average, so the short-term trend is {'up' if up_trend else 'down'}.")

    r5 = row["ret_5"]
    parts.append(_clip(r5 / 0.05) * 0.6)
    reasons.append(f"The stock moved {r5 * 100:+.1f}% over the last 5 trading days and {row['ret_20'] * 100:+.1f}% over 20.")

    if not pd.isna(row.get("sma200")):
        above = row["Close"] > row["sma200"]
        parts.append(0.3 if above else -0.3)
        reasons.append(f"Price is {'above' if above else 'below'} its 200-day average, the long-term trend line.")

    an = _analogs(df)
    if an:
        edge = an["upRate"] - an["baseUpRate"]
        parts.append(_clip(edge / 0.08))
        reasons.append(
            f"In {an['years']:.0f} years of history, {an['matches']} days looked like today. "
            f"The next day closed higher {an['upRate'] * 100:.0f}% of the time, vs {an['baseUpRate'] * 100:.0f}% on a typical day."
        )

    score = _clip(float(np.mean(parts)))
    return {
        "id": "historical", "name": "Historical Agent", "score": score, "stance": _stance(score), "vote": _direction(score),
        "summary": "Moving-average trend, recent returns, and how this stock behaved after similar days in its past.",
        "reasons": reasons, "analogs": an,
        "metrics": [
            {"label": "SMA 5", "value": f"{row['sma5']:,.2f}"},
            {"label": "SMA 20", "value": f"{row['sma20']:,.2f}"},
            {"label": "5-day return", "value": f"{r5 * 100:+.2f}%"},
            {"label": "Similar days up", "value": f"{an['upRate'] * 100:.0f}% of {an['matches']}" if an else "–"},
        ],
    }


# ---------------------------------------------------------------------------
# Volatility agent: risk level (doesn't vote)
# ---------------------------------------------------------------------------
def volatility_agent(df: pd.DataFrame) -> dict:
    row = df.iloc[-1]
    vol_hist = df["vol_20"].dropna().iloc[-252:]
    pct = float((vol_hist < row["vol_20"]).mean() * 100) if len(vol_hist) else 50.0
    annual = row["vol_20"] * np.sqrt(252) * 100
    if pct >= 80:
        level, damp = "HIGH", 0.6
    elif pct >= 50:
        level, damp = "MEDIUM", 0.85
    else:
        level, damp = "LOW", 1.0
    dd = row["dist_52w_high"] * 100
    reasons = [
        f"20-day volatility is {row['vol_20'] * 100:.2f}% a day ({annual:.0f}% a year), higher than {pct:.0f}% of the past year.",
        f"Today's move was {row['daily_return'] * 100:+.2f}%; the typical daily range (ATR) is {row['atr_pct'] * 100:.1f}% of the price.",
        f"The stock is {abs(dd):.1f}% below its 52-week high." if dd < -0.5 else "The stock is trading near its 52-week high.",
    ]
    if level != "LOW":
        reasons.append(f"Risk is {level.lower()}, so the final signal's conviction is scaled to {damp:.0%}.")
    return {
        "id": "volatility", "name": "Volatility Agent", "score": 0.0, "stance": level, "vote": None,
        "summary": "Measures price swings and market risk. Doesn't vote on direction, but tempers conviction.",
        "reasons": reasons, "dampener": damp,
        "metrics": [
            {"label": "Volatility (20d)", "value": f"{row['vol_20'] * 100:.2f}%"},
            {"label": "Daily return", "value": f"{row['daily_return'] * 100:+.2f}%"},
            {"label": "Vol percentile", "value": f"{pct:.0f}th"},
            {"label": "From 52w high", "value": f"{dd:.1f}%"},
        ],
    }


# ---------------------------------------------------------------------------
# ML model agent
# ---------------------------------------------------------------------------
def model_agent(p_up: float, base_rate: float, n_stocks: int) -> dict:
    score = _clip((p_up - 0.5) / 0.1)  # next-day probabilities cluster near 50%, so scale the edge
    direction = "UP" if p_up >= 0.5 else "DOWN"
    return {
        "id": "model", "name": "ML Model", "score": score, "stance": _stance(score), "vote": direction,
        "summary": f"LightGBM trained on 20 features across {n_stocks} stocks.",
        "reasons": [
            f"The model gives a {p_up * 100:.1f}% chance the next close is higher.",
            f"For comparison, {base_rate * 100:.1f}% of days closed higher in the training data.",
        ],
        "metrics": [
            {"label": "P(up)", "value": f"{p_up * 100:.1f}%"},
            {"label": "P(down)", "value": f"{(1 - p_up) * 100:.1f}%"},
        ],
    }


# ---------------------------------------------------------------------------
# Fusion
# ---------------------------------------------------------------------------
WEIGHTS = {"model": 0.5, "technical": 0.25, "historical": 0.25}


def fuse(agents: list[dict]) -> dict:
    by_id = {a["id"]: a for a in agents}
    present = {k: w for k, w in WEIGHTS.items() if k in by_id}
    total = sum(present.values()) or 1
    raw = sum(w * by_id[k]["score"] for k, w in present.items()) / total
    damp = by_id.get("volatility", {}).get("dampener", 1.0)
    score = raw * damp
    signal = "BUY" if score >= 0.2 else "SELL" if score <= -0.2 else "HOLD"

    votes = [{"agent": by_id[k]["name"], "vote": by_id[k]["vote"]} for k in present]
    up = sum(v["vote"] == "UP" for v in votes)
    down = sum(v["vote"] == "DOWN" for v in votes)
    majority = "UP" if up > down else "DOWN" if down > up else "HOLD"

    if signal == "BUY":
        reason = "The weighted agent score is above +0.20, so the agents lean bullish for the next session."
    elif signal == "SELL":
        reason = "The weighted agent score is below −0.20, so the agents lean bearish for the next session."
    else:
        reason = "The weighted agent score is between −0.20 and +0.20: the agents disagree or the edge is too small, so the system recommends waiting."

    weights_txt = ", ".join(f"{by_id[k]['name']} {w / total:.0%}" for k, w in present.items())
    return {
        "signal": signal, "score": float(score), "rawScore": float(raw), "dampener": damp,
        "reason": reason,
        "votes": votes, "upVotes": up, "downVotes": down, "majority": majority,
        "agreement": f"{max(up, down)} of {len(votes)}",
        "explanation": (
            f"Weighted vote ({weights_txt}) gives {raw:+.2f}"
            + (f", scaled by the Volatility Agent to {score:+.2f}" if damp < 1 else "")
            + ". Above +0.20 is BUY, below −0.20 is SELL, in between is HOLD."
        ),
    }
