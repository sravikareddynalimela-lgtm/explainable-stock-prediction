import yfinance as yf
import ta

# Download stock data
data = yf.download("AAPL", start="2023-01-01", end="2025-01-01")

# Fix the Close column
close = data["Close"].squeeze()

# Calculate RSI
data["RSI"] = ta.momentum.RSIIndicator(close).rsi()

# Calculate Moving Average
data["SMA_20"] = close.rolling(window=20).mean()

# Calculate MACD
macd = ta.trend.MACD(close)
data["MACD"] = macd.macd()

# Display data
print(data.tail())