import yfinance as yf

# Download historical stock data
data = yf.download("AAPL", start="2023-01-01", end="2025-01-01")

# Get Close prices
close = data["Close"].squeeze()

# Calculate returns
data["Daily_Return"] = close.pct_change()

# Calculate 5-day and 20-day moving averages
data["SMA_5"] = close.rolling(window=5).mean()
data["SMA_20"] = close.rolling(window=20).mean()

# Remove empty rows
data = data.dropna()

# Get latest values
latest_close = close.iloc[-1]
latest_sma5 = data["SMA_5"].iloc[-1]
latest_sma20 = data["SMA_20"].iloc[-1]

# Analyze historical trend
print("Latest Close Price:", round(latest_close, 2))
print("5-Day Moving Average:", round(latest_sma5, 2))
print("20-Day Moving Average:", round(latest_sma20, 2))

# Determine trend
if latest_sma5 > latest_sma20:
    print("\nHistorical Pattern: UPWARD TREND 📈")
elif latest_sma5 < latest_sma20:
    print("\nHistorical Pattern: DOWNWARD TREND 📉")
else:
    print("\nHistorical Pattern: SIDEWAYS TREND ➡️")

# Show recent historical data
print("\nRecent Historical Data:")
print(data[["SMA_5", "SMA_20", "Daily_Return"]].tail())