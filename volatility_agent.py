import yfinance as yf
import pandas as pd

# Download stock data
data = yf.download("AAPL", start="2023-01-01", end="2025-01-01")

# Get Close prices
close = data["Close"].squeeze()

# Calculate daily returns
data["Daily_Return"] = close.pct_change()

# Calculate volatility using 20-day rolling standard deviation
data["Volatility"] = data["Daily_Return"].rolling(window=20).std()

# Remove empty values
data = data.dropna()

# Show latest results
print(data[["Daily_Return", "Volatility"]].tail())

# Determine risk level
latest_volatility = data["Volatility"].iloc[-1]

if latest_volatility < 0.01:
    print("\nRisk Level: LOW")
elif latest_volatility < 0.02:
    print("\nRisk Level: MEDIUM")
else:
    print("\nRisk Level: HIGH")