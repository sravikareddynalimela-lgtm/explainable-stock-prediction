import pandas as pd
import joblib
import shap
import matplotlib.pyplot as plt

# Load the trained model
model = joblib.load("stock_prediction_model.pkl")

# Load fused stock data
data = pd.read_csv("fused_stock_data.csv")

# Features used by the model
features = [
    "RSI",
    "SMA_20",
    "MACD",
    "Volatility",
    "SMA_5",
    "Historical_Return"
]

# Remove missing values
data = data.dropna()

# Select feature data
X = data[features]

# Create SHAP explainer
explainer = shap.TreeExplainer(model)

# Calculate SHAP values
shap_values = explainer.shap_values(X)

# Show feature importance summary
shap.summary_plot(shap_values, X)