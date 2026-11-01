"""Runtime configuration, read from environment variables."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

try:  # load backend/.env for local development
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass
MODEL_DIR = Path(os.getenv("MODEL_DIR", BASE_DIR / "models"))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# "yahoo" = live Yahoo Finance data (default). "demo" = simulated prices, for offline dev/tests only.
DATA_SOURCE = os.getenv("DATA_SOURCE", "yahoo").lower()

# Comma-separated list of allowed frontend origins, e.g. https://your-app.vercel.app
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

# Seconds between live quote pushes on the SSE stream.
STREAM_INTERVAL = float(os.getenv("STREAM_INTERVAL", "5"))

# Train the model in the background on startup if no saved model is found.
AUTO_TRAIN = os.getenv("AUTO_TRAIN", "1") == "1"

# Stocks the model is trained on. Any Yahoo symbol can still be analysed.
TRAINING_UNIVERSE = [
    # US large caps
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "UNH",
    "XOM", "JNJ", "WMT", "PG", "HD", "KO", "NFLX", "AMD", "COST", "BAC",
    # India (NSE)
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "LT.NS", "HINDUNILVR.NS",
]

DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA",
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS",
]

HISTORY_YEARS = int(os.getenv("HISTORY_YEARS", "10"))

# Index / macro tickers for the ticker tape and the login page.
MARKET_INDICES = [
    ("^NSEI", "NIFTY 50"),
    ("^BSESN", "SENSEX"),
    ("^NSEBANK", "BANK NIFTY"),
    ("^GSPC", "S&P 500"),
    ("^IXIC", "NASDAQ"),
    ("^DJI", "DOW"),
    ("INR=X", "USD/INR"),
    ("GC=F", "GOLD"),
    ("CL=F", "CRUDE"),
    ("BTC-USD", "BITCOIN"),
]

# Emails allowed to trigger POST /api/model/retrain (comma-separated).
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()}
