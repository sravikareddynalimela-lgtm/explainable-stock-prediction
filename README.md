# Clearview: explainable stock signals

Live stock prices with a next-day direction prediction and a plain-English explanation of *why* the model made it.

A rebuild of the original Streamlit project (`explainable-stock-prediction`) on a new stack:

| Layer | Before | Now |
|---|---|---|
| UI | Streamlit | **React 19 + TypeScript + Vite**, Tailwind CSS v4, TradingView Lightweight Charts, TanStack Query |
| API | none (all in Streamlit) | **FastAPI** REST API + Server-Sent Events stream for live quotes |
| Model | Random Forest, 6 raw features | **LightGBM**, 20 scale-free features, trained across 30 US and Indian stocks |
| Evaluation | single train/test split | **walk-forward** testing (6 retrains over 3 years, only scored on unseen days) |
| Explanations | `shap` package + matplotlib | LightGBM's built-in exact TreeSHAP, shown as an interactive waterfall |
| Data | yfinance, fixed date range | **live** Yahoo Finance quotes (refreshed every 5s), intraday and daily history, headlines, symbol search |

## What's on the dashboard

- **Live quote** for any Yahoo symbol (US stocks like `AAPL`, Indian stocks like `INFY.NS`), with market state and day range
- **Candlestick chart** with volume, 20/50-day averages and Bollinger bands, from 1 day (5-minute bars) to 5 years; the last candle moves with the live price
- **Signal** (Buy / Sell / Hold) from a weighted vote of four agents:
  - **ML model** (50%): LightGBM probability that the next close is higher
  - **Technical agent** (25%): RSI, MACD, Bollinger %B, volume confirmation
  - **Trend agent** (25%): price vs 20/50/200-day averages, 20-day return
  - **Risk agent**: doesn't vote; scales conviction down when volatility is high
- **Why the model says up/down**: SHAP waterfall from the base rate to the final probability, one bar per feature
- **Track record**: walk-forward accuracy vs. a naive baseline, ROC AUC, accuracy on the most confident 20% of calls, and an equity curve of "invest only when the model says up" vs buy & hold
- **Watchlist** with live prices (saved in your browser) and **search** across every Yahoo-listed symbol
- **Latest headlines** for the selected stock

## Run locally

Requirements: Python 3.10+, Node 20+. On a Mac, LightGBM also needs OpenMP: `brew install libomp`.

```bash
./dev.sh
```

That creates a virtualenv, installs everything, and starts the API on <http://localhost:8000> and the dashboard on <http://localhost:5173>.

On first start there's no trained model yet, so the backend downloads 10 years of daily data for the 30 training stocks and trains in the background (about 1–3 minutes). A progress bar shows at the top of the dashboard; live prices, charts and the rule-based agents work in the meantime.

Or run the pieces yourself:

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python train.py                 # optional: train up front and print the evaluation
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev
```

## Deploy online

The backend goes on **Render** (free tier works), the frontend on **Vercel**.

1. **Train once locally and commit the model** so the server doesn't retrain after every restart (Render's free disk is wiped when the service sleeps):
   ```bash
   cd backend && python train.py
   git add models/model.joblib models/metrics.json && git commit -m "Add trained model"
   ```
2. **Push this folder to GitHub.**
3. **Backend on Render**: Dashboard → New → Blueprint → choose the repo. `render.yaml` sets everything up. Note the URL it gives you (e.g. `https://clearview-api.onrender.com`) and open `/api/health` to check it.
4. **Frontend on Vercel**: New Project → import the repo → set **Root Directory** to `frontend` → add environment variable `VITE_API_URL` = your Render URL → Deploy.
5. Back in Render, set `CORS_ORIGINS` to your Vercel URL (e.g. `https://clearview.vercel.app`) and redeploy.

Free Render services sleep after 15 minutes idle; the first request after that takes ~30–60 seconds.

## Configuration (backend environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `DATA_SOURCE` | `yahoo` | `yahoo` for live data. `demo` uses simulated prices for offline development only; the UI shows a "Simulated data" badge. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed frontend origins |
| `STREAM_INTERVAL` | `5` | Seconds between live quote pushes |
| `AUTO_TRAIN` | `1` | Train in the background on startup if no saved model exists |
| `HISTORY_YEARS` | `10` | Years of daily history used for training |
| `MODEL_DIR` | `backend/models` | Where the model and metrics are saved |

Retrain any time with `python train.py` (or `python train.py AAPL MSFT ...` for a custom set) or `POST /api/model/retrain`.

## API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | status, data source, model training state |
| `GET /api/quote/{symbol}` / `GET /api/quotes?symbols=A,B` | live quotes |
| `GET /api/stream?symbols=A,B` | Server-Sent Events: `quotes` event every few seconds |
| `GET /api/history/{symbol}?range=1d\|5d\|1mo\|3mo\|6mo\|1y\|5y` | candles, SMA 20/50, Bollinger bands, RSI |
| `GET /api/analysis/{symbol}` | prediction, SHAP contributions, agents, fused signal, track record |
| `GET /api/news/{symbol}` | recent headlines |
| `GET /api/search?q=` | symbol search |
| `GET /api/model` | walk-forward metrics and feature importance |

Interactive docs: <http://localhost:8000/docs>.

## Project structure

```
backend/
  app/
    config.py      settings and training universe
    data.py        Yahoo Finance data layer with caching (+ offline demo mode)
    features.py    indicators and the 20 model features
    agents.py      technical, trend, risk and model agents + fusion
    model.py       LightGBM training, walk-forward evaluation, SHAP
    main.py        FastAPI routes and the live SSE stream
  train.py         command-line training
  models/          saved model + metrics (created by training)
frontend/
  src/
    App.tsx        page layout and state
    components/    PriceChart, Verdict, WhyWaterfall, Agents, TrackRecord, News, Watchlist, Search
    lib/           API client, live-quote hook, formatters
render.yaml        Render blueprint (backend)
frontend/vercel.json  Vercel config (frontend)
dev.sh             start both locally
```

## How the model works

- **Target**: will the next session's close be higher than today's?
- **Features**: all ratios or percentages (price vs moving averages, returns over 1/5/10/20 days, RSI, MACD as % of price, Bollinger %B and width, ATR %, volatility and its short/long ratio, volume vs average, distance from 52-week high, stochastic %K), so one model can learn from a $20 stock and a ₹3,000 stock together. The original model used raw SMA prices, which don't transfer between stocks.
- **Evaluation**: the last 3 years are split into 6 periods. For each, the model is trained only on earlier data (with a one-day gap so labels can't leak) and scored on that period. Every accuracy figure in the UI comes from these out-of-sample predictions.
- **Final model**: retrained on all data after evaluation.
- **Explanations**: LightGBM computes exact SHAP values in log-odds; the dashboard converts them into percentage-point changes in P(up), from the base rate to the final prediction.

During market hours, the latest daily bar is still forming, so the prediction updates as the day goes on.

## Honest expectations

Next-day stock direction is close to random. Expect walk-forward accuracy a point or two above the naive baseline, and AUC slightly above 0.5. The dashboard shows these numbers next to the baseline so it never overstates what the model can do.

This is an educational project. Nothing here is financial advice.
