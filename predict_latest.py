import yfinance as yf
import ta
import joblib

# Load trained model
model = joblib.load("stock_prediction_model.pkl")

# Download recent stock data
data = yf.download("AAPL", period="6mo")

# Get Close prices
close = data["Close"].squeeze()

# Create the same features used during training
data["RSI"] = ta.momentum.RSIIndicator(close).rsi()
data["SMA_20"] = close.rolling(window=20).mean()
data["MACD"] = ta.trend.MACD(close).macd()

data["Daily_Return"] = close.pct_change()
data["Volatility"] = data["Daily_Return"].rolling(window=20).std()

data["SMA_5"] = close.rolling(window=5).mean()
data["Historical_Return"] = close.pct_change(periods=5)

# Remove empty rows
data = data.dropna()

# Features
features = [
    "RSI",
    "SMA_20",
    "MACD",
    "Volatility",
    "SMA_5",
    "Historical_Return"
]

# Get latest data
latest_data = data[features].iloc[[-1]]

# Predict
prediction = model.predict(latest_data)[0]

# Confidence
probability = model.predict_proba(latest_data)[0]
confidence = max(probability) * 100

print("\n📊 STOCK PREDICTION RESULT")

if prediction == 1:
    print("Prediction: 📈 UP")
else:
    print("Prediction: 📉 DOWN")

print("Confidence:", round(confidence, 2), "%")
# Recommendation system

if prediction == 1 and confidence >= 60:
    recommendation = "BUY 🟢"

elif prediction == 0 and confidence >= 60:
    recommendation = "SELL 🔴"

else:
    recommendation = "HOLD 🟡"

print("Recommendation:", recommendation)