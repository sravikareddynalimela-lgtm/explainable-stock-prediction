# Clearview: explainable stock signals

A live trading-terminal dashboard for NSE and US stocks, with user accounts, a next-day direction prediction, and a plain-English explanation of *why* the model made it.

| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite, Tailwind CSS v4, TradingView Lightweight Charts, TanStack Query, React Router |
| Accounts | **Supabase Auth** (email + password, email confirmation, password reset) and a per-user watchlist table with row-level security |
| API | FastAPI: REST endpoints + Server-Sent Events stream for live quotes; every data endpoint checks the user's Supabase token |
| Model | LightGBM, 20 scale-free features, trained across 30 US and Indian stocks, walk-forward tested, exact TreeSHAP explanations |
| Data | Live Yahoo Finance quotes (refreshed every 5s), intraday and daily history, indices, headlines, symbol search |

## Features

- **Sign up, log in, forgot/reset password.** The login page shows a live index board and ticker.
- **Your own watchlist**, saved to your account and synced across devices; sort by gainers/losers, prices flash on every tick
- **Ticker tape** with NIFTY 50, SENSEX, BANK NIFTY, S&P 500, NASDAQ, DOW, USD/INR, gold, crude and bitcoin, plus NSE/NYSE open/closed status
- **Chart**: candles or line, 1D to 5Y, volume, SMA 20/50, Bollinger bands, OHLC readout under the crosshair; the last candle moves with the live price
- **Signal** (BUY / SELL / HOLD) from a weighted vote: ML model 50%, technical agent 25%, trend agent 25%, with the risk agent scaling conviction down in volatile markets
- **Why this call**: SHAP waterfall from the base rate to the final probability, one bar per feature
- **Agents**: what each agent sees and why
- **Backtest**: walk-forward accuracy vs. a naive baseline, ROC AUC, and an equity curve of "invest only when the model says up" vs buy & hold
- **News**: latest headlines for the stock

---

## 1. Set up Supabase (one time, about 5 minutes)

1. Create a free project at <https://supabase.com/dashboard>.
2. **Create the watchlist table.** Open **SQL Editor → New query**, paste everything in [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. **Set the redirect URLs** so confirmation and reset emails link back to your app. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:5173` (change this to your Vercel URL once deployed)
   - **Redirect URLs**: add `http://localhost:5173/**` (and later `https://<your-app>.vercel.app/**`)
4. **Copy your keys.** Under **Project Settings → API Keys** (or the **Connect** button), copy the **Project URL** and the **publishable key** (`sb_publishable_...`; older projects show an `anon` key, which also works).
5. Optional: email confirmation is on by default. For quicker local testing you can turn it off under **Authentication → Sign In / Providers → Email → Confirm email**.

Supabase's built-in email sender is rate-limited (a few emails per hour). That's fine for testing; for real users, add your own SMTP under **Authentication → Emails → SMTP Settings**.

## 2. Run locally

Requirements: Python 3.10+, Node 20+. On a Mac, LightGBM also needs OpenMP: `brew install libomp`.

Create the two env files:

```bash
cd ~/developer/stocks_prediction
cp frontend/.env.example frontend/.env.local
cp backend/.env.example backend/.env
```

Then edit them:

- `frontend/.env.local`: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- `backend/.env`: set `SUPABASE_URL` (same URL)

Start everything:

```bash
./dev.sh
```

Open <http://localhost:5173>, create an account, and log in.

On the very first start the backend downloads 10 years of data for 30 stocks and trains the model in the background (a progress bar shows at the top). Prices, charts and the rule-based agents work right away; the prediction appears when training finishes.

<details>
<summary>Run the two parts by hand instead</summary>

```bash
# terminal 1: backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python train.py                      # optional: train now and print the evaluation
uvicorn app.main:app --reload --port 8000

# terminal 2: frontend
cd frontend
npm install
npm run dev
```
</details>

## 3. Deploy

Backend on **Render**, frontend on **Vercel**, accounts on **Supabase**.

1. **Train once locally and commit the model**, so the server doesn't retrain after every restart:
   ```bash
   cd backend && python train.py
   git add models/model.joblib models/metrics.json && git commit -m "Add trained model"
   ```
2. **Push to GitHub.**
3. **Render** → New → Blueprint → choose the repo. Fill in `SUPABASE_URL`, `ADMIN_EMAILS` (your email) and, after step 4, `CORS_ORIGINS`. Check `https://<render-url>/api/health` shows `"authEnabled": true`.
4. **Vercel** → New Project → import the repo → **Root Directory** `frontend` → environment variables:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_API_URL` = your Render URL
5. Back in Render, set `CORS_ORIGINS` to your Vercel URL. In Supabase, change **Site URL** to the Vercel URL and add it to **Redirect URLs**.

Free Render services sleep after 15 minutes idle; the first request after that takes 30–60 seconds.

## Configuration

**Backend** (`backend/.env` locally, Render environment in production)

| Variable | Default | Meaning |
|---|---|---|
| `SUPABASE_URL` | – | Your Supabase project URL. Required for login checks. If empty, the API runs without auth (local experiments only). |
| `SUPABASE_JWT_SECRET` | – | Only for older projects on the legacy JWT secret. New projects verify tokens with Supabase's public keys automatically. |
| `ADMIN_EMAILS` | – | Emails allowed to call `POST /api/model/retrain` |
| `DATA_SOURCE` | `yahoo` | `demo` uses simulated prices for offline development; the UI shows a "Simulated data" badge |
| `CORS_ORIGINS` | `*` | Allowed frontend origins, comma-separated |
| `STREAM_INTERVAL` | `5` | Seconds between live quote pushes |
| `AUTO_TRAIN` | `1` | Train in the background on startup if no saved model exists |
| `HISTORY_YEARS` | `10` | Years of daily history used for training |

**Frontend** (`frontend/.env.local` locally, Vercel environment in production)

| Variable | Meaning |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable (or legacy anon) key. Safe to expose in the browser. |
| `VITE_API_URL` | Backend URL. Leave empty locally. |

Never put the Supabase **secret** / `service_role` key in the frontend.

## How login works

1. The browser signs up / logs in directly with Supabase (supabase-js) and gets a short-lived access token, refreshed automatically.
2. Every API call sends that token as `Authorization: Bearer …` (the live-price stream sends it as `?token=` because browsers' EventSource can't set headers).
3. FastAPI verifies the token's signature against Supabase's public keys (JWKS), its audience (`authenticated`), issuer and expiry. Invalid or expired tokens get a 401 and the app returns to the login page.
4. The watchlist is read and written straight from the browser to Supabase; row-level security makes sure each user only ever sees their own rows.

## API

`GET /api/health`, `GET /api/config` and `GET /api/public/markets` (index quotes for the login page) are public. Everything else needs a logged-in user:

| Endpoint | Returns |
|---|---|
| `GET /api/me` | the logged-in user |
| `GET /api/quote/{symbol}` · `GET /api/quotes?symbols=A,B` | live quotes |
| `GET /api/stream?symbols=A,B` | Server-Sent Events: a `quotes` event every few seconds |
| `GET /api/history/{symbol}?range=1d…5y` | candles, SMA 20/50, Bollinger bands, RSI |
| `GET /api/analysis/{symbol}` | prediction, SHAP contributions, agents, fused signal, track record |
| `GET /api/news/{symbol}` · `GET /api/search?q=` | headlines, symbol search |
| `GET /api/model` · `POST /api/model/retrain` | metrics; retrain (admins only) |

Interactive docs: <http://localhost:8000/docs>.

## Project structure

```
backend/
  app/
    auth.py        Supabase token verification
    config.py      settings, training universe, index list
    data.py        Yahoo Finance data layer with caching (+ offline demo mode)
    features.py    indicators and the 20 model features
    agents.py      technical, trend, risk and model agents + fusion
    model.py       LightGBM training, walk-forward evaluation, SHAP
    main.py        API routes and the live SSE stream
  train.py         command-line training
frontend/
  src/
    main.tsx       routes and login guards
    pages/         AuthPage (login, sign up, forgot, reset), Dashboard
    components/    PriceChart, TickerTape, Watchlist, Verdict, WhyWaterfall, Agents, TrackRecord, News, Search, UserMenu
    lib/           Supabase client, auth context, API client, live quotes, watchlist sync
supabase/schema.sql   watchlist table + row-level security
render.yaml           Render blueprint (backend)
dev.sh                start both locally
```

## How the model works

- **Target**: will the next session's close be higher than today's?
- **Features**: all ratios or percentages (price vs moving averages, 1/5/10/20-day returns, RSI, MACD as % of price, Bollinger %B and width, ATR %, volatility and its short/long ratio, volume vs average, distance from 52-week high, stochastic %K), so one model learns from a $20 stock and a ₹3,000 stock together.
- **Evaluation**: the last 3 years are split into 6 periods; for each, the model is trained only on earlier data (with a one-day gap so labels can't leak) and scored on that period. Every accuracy figure in the UI comes from these out-of-sample predictions.
- **Explanations**: LightGBM's exact TreeSHAP values, converted from log-odds into percentage-point changes in P(up).

## Honest expectations

Next-day stock direction is close to random. Expect walk-forward accuracy a point or two above the naive baseline and AUC slightly above 0.5. The dashboard always shows the baseline next to the model so it never overstates what it can do.

This is an educational project. Nothing here is financial advice.
