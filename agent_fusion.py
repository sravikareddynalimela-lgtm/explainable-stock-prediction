import yfinance as yf
import pandas as pd
import ta

# ==========================================
# 1. STOCKS TO INCLUDE
# ==========================================

STOCKS = {
    "AAPL": "Apple",
    "MSFT": "Microsoft",
    "GOOGL": "Google",
    "NVDA": "NVIDIA",
    "RELIANCE.NS": "Reliance",
    "TCS.NS": "TCS"
}

all_stock_data = []

# ==========================================
# 2. DOWNLOAD AND PROCESS EACH STOCK
# ==========================================

for ticker, company_name in STOCKS.items():

    print(f"\nDownloading {company_name} ({ticker})...")

    try:
        data = yf.download(
            ticker,
            start="2022-01-01",
            end="2026-01-01",
            auto_adjust=True,
            progress=False
        )

        if data.empty:
            print(f"WARNING: No data found for {ticker}. Skipping.")
            continue

        # Handle yfinance multi-level column names.
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.get_level_values(0)

        data = data.loc[:, ~data.columns.duplicated()].copy()

        close = data["Close"]

        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]

        close = pd.to_numeric(close, errors="coerce")

        # ======================================
        # TECHNICAL AGENT
        # ======================================

        data["RSI"] = ta.momentum.RSIIndicator(
            close, window=14
        ).rsi()

        data["SMA_20"] = close.rolling(20).mean()

        macd = ta.trend.MACD(close)

        data["MACD"] = macd.macd()

        data["Technical_Signal"] = 0

        technical_up = (
            (data["RSI"] < 70)
            & (data["MACD"] > 0)
            & (close > data["SMA_20"])
        )

        technical_down = (
            (data["RSI"] > 30)
            & (data["MACD"] < 0)
            & (close < data["SMA_20"])
        )

        data.loc[technical_up, "Technical_Signal"] = 1
        data.loc[technical_down, "Technical_Signal"] = -1

        # ======================================
        # VOLATILITY AGENT
        # ======================================

        data["Daily_Return"] = close.pct_change()

        data["Volatility"] = (
            data["Daily_Return"].rolling(20).std()
        )

        # Calculate risk threshold separately for each stock.
        risk_threshold = data["Volatility"].quantile(0.75)

        data["Volatility_Risk"] = (
            data["Volatility"] > risk_threshold
        ).astype(int)

        # ======================================
        # HISTORICAL AGENT
        # ======================================

        data["SMA_5"] = close.rolling(5).mean()

        data["Historical_Return"] = close.pct_change(5)

        data["Historical_Signal"] = 0

        historical_up = (
            (data["SMA_5"] > data["SMA_20"])
            & (data["Historical_Return"] > 0)
        )

        historical_down = (
            (data["SMA_5"] < data["SMA_20"])
            & (data["Historical_Return"] < 0)
        )

        data.loc[historical_up, "Historical_Signal"] = 1
        data.loc[historical_down, "Historical_Signal"] = -1

        # ======================================
        # AGENT FUSION
        # ======================================

        data["Agent_Fusion_Score"] = (
            data["Technical_Signal"]
            + data["Historical_Signal"]
        )

        data["Agent_Fusion_Decision"] = "HOLD"

        data.loc[
            data["Agent_Fusion_Score"] > 0,
            "Agent_Fusion_Decision"
        ] = "UP"

        data.loc[
            data["Agent_Fusion_Score"] < 0,
            "Agent_Fusion_Decision"
        ] = "DOWN"

        # ======================================
        # CLEAN EACH STOCK'S DATA
        # ======================================

        data = data.dropna().copy()

        data = data.reset_index()

        if "Date" not in data.columns:
            data = data.rename(
                columns={data.columns[0]: "Date"}
            )

        data["Ticker"] = ticker
        data["Company"] = company_name

        all_stock_data.append(data)

        print(
            f"Successfully processed {ticker}: "
            f"{len(data)} rows"
        )

    except Exception as error:
        print(f"ERROR processing {ticker}: {error}")


# ==========================================
# 3. COMBINE ALL STOCKS
# ==========================================

if not all_stock_data:
    raise SystemExit(
        "\nERROR: No stock data was downloaded successfully."
    )

combined_data = pd.concat(
    all_stock_data,
    ignore_index=True
)

combined_data["Date"] = pd.to_datetime(
    combined_data["Date"],
    errors="coerce"
)

combined_data = combined_data.dropna(
    subset=["Date", "Close"]
)

combined_data = combined_data.sort_values(
    ["Date", "Ticker"]
).reset_index(drop=True)

# ==========================================
# 4. SAVE DATASET
# ==========================================

combined_data.to_csv(
    "fused_stock_data.csv",
    index=False
)

print("\n==========================================")
print("MULTI-STOCK AGENT FUSION COMPLETED")
print("==========================================")

print("\nStocks included:")
print(combined_data["Ticker"].unique().tolist())

print("\nRows per stock:")
print(combined_data.groupby("Ticker").size())

print("\nFinal dataset shape:", combined_data.shape)

print("\nLatest agent decisions:")
print(
    combined_data[
        [
            "Date",
            "Ticker",
            "RSI",
            "MACD",
            "Volatility",
            "Technical_Signal",
            "Historical_Signal",
            "Agent_Fusion_Score",
            "Agent_Fusion_Decision"
        ]
    ].tail(10).to_string(index=False)
)

print("\nDataset saved to fused_stock_data.csv")
