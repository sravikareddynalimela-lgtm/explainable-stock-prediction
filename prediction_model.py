import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

print("=" * 60)
print("MULTI-STOCK RANDOM FOREST MODEL TRAINING")
print("=" * 60)

# ==========================================
# STEP 1: LOAD DATASET
# ==========================================

try:
    data = pd.read_csv("fused_stock_data.csv")
except FileNotFoundError:
    raise SystemExit(
        "ERROR: fused_stock_data.csv not found. "
        "Run python agent_fusion.py first."
    )

required_columns = [
    "Date",
    "Ticker",
    "Close",
    "RSI",
    "SMA_20",
    "MACD",
    "Volatility",
    "SMA_5",
    "Historical_Return"
]

missing = [
    column for column in required_columns
    if column not in data.columns
]

if missing:
    raise SystemExit(f"Missing required columns: {missing}")

data["Date"] = pd.to_datetime(data["Date"], errors="coerce")

numeric_columns = [
    "Close",
    "RSI",
    "SMA_20",
    "MACD",
    "Volatility",
    "SMA_5",
    "Historical_Return"
]

for column in numeric_columns:
    data[column] = pd.to_numeric(
        data[column],
        errors="coerce"
    )

data = data.replace([np.inf, -np.inf], np.nan)

data = data.dropna(
    subset=["Date", "Ticker"] + numeric_columns
).copy()

data["Ticker"] = data["Ticker"].astype(str)

# Sort dates within each stock.
data = data.sort_values(
    ["Ticker", "Date"]
).reset_index(drop=True)

print("\nRows loaded:", len(data))
print("Stocks found:", sorted(data["Ticker"].unique()))

# ==========================================
# STEP 2: CREATE NEXT-DAY TARGET
# ==========================================

# Calculate the next closing price separately for each stock.
data["Next_Close"] = (
    data.groupby("Ticker")["Close"].shift(-1)
)

# 1 = next closing price is higher
# 0 = next closing price is equal to or lower
data["Target"] = (
    data["Next_Close"] > data["Close"]
).astype(int)

# Remove each stock's final row because its next-day
# closing price is not present in the dataset.
data = data.dropna(subset=["Next_Close"]).copy()

# ==========================================
# STEP 3: SELECT FEATURES
# ==========================================

# Keep the original six features so the existing
# Streamlit app can continue using the same feature order.

features = [
    "RSI",
    "SMA_20",
    "MACD",
    "Volatility",
    "SMA_5",
    "Historical_Return"
]

X = data[features]
y = data["Target"]

print("\nUsable rows:", len(data))
print("DOWN targets:", int((y == 0).sum()))
print("UP targets:", int((y == 1).sum()))

# ==========================================
# STEP 4: CHRONOLOGICAL TRAIN/TEST SPLIT
# ==========================================

# Split using unique dates so that rows from the same date
# cannot appear in both training and testing sets.

unique_dates = np.sort(data["Date"].unique())

if len(unique_dates) < 2:
    raise SystemExit("ERROR: Not enough dates for evaluation.")

split_position = int(len(unique_dates) * 0.80)

split_position = min(
    max(split_position, 1),
    len(unique_dates) - 1
)

split_date = unique_dates[split_position]

train_mask = data["Date"] < split_date
test_mask = data["Date"] >= split_date

X_train = X.loc[train_mask]
X_test = X.loc[test_mask]

y_train = y.loc[train_mask]
y_test = y.loc[test_mask]

print("\nTraining rows:", len(X_train))
print("Testing rows:", len(X_test))
print("Training ends before:", split_date)
print("Testing starts on or after:", split_date)

if len(X_train) == 0 or len(X_test) == 0:
    raise SystemExit("ERROR: Training or testing data is empty.")

if y_train.nunique() < 2:
    raise SystemExit(
        "ERROR: Training data contains only one target class."
    )

if y_test.nunique() < 2:
    print(
        "WARNING: Test data contains only one target class. "
        "Interpret evaluation metrics carefully."
    )

# ==========================================
# STEP 5: TRAIN RANDOM FOREST
# ==========================================

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_leaf=5,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)

# ==========================================
# STEP 6: EVALUATE MODEL
# ==========================================

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

precision = precision_score(
    y_test,
    predictions,
    zero_division=0
)

recall = recall_score(
    y_test,
    predictions,
    zero_division=0
)

f1 = f1_score(
    y_test,
    predictions,
    zero_division=0
)

# Baseline: always predict the most frequent training class.
majority_class = y_train.value_counts().idxmax()

baseline_predictions = np.full(
    len(y_test),
    majority_class
)

baseline_accuracy = accuracy_score(
    y_test,
    baseline_predictions
)

print("\n" + "=" * 60)
print("MODEL EVALUATION")
print("=" * 60)

print(f"Accuracy:          {accuracy * 100:.2f}%")
print(f"Baseline accuracy: {baseline_accuracy * 100:.2f}%")
print(f"UP precision:      {precision * 100:.2f}%")
print(f"UP recall:         {recall * 100:.2f}%")
print(f"UP F1-score:       {f1 * 100:.2f}%")

print("\nConfusion Matrix")
print("Rows = Actual; Columns = Predicted")
print("Class 0 = DOWN, Class 1 = UP")

print(
    confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1]
    )
)

print("\nClassification Report")

print(
    classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["DOWN", "UP"],
        zero_division=0
    )
)

# ==========================================
# STEP 7: FEATURE IMPORTANCE
# ==========================================

importance = pd.DataFrame({
    "Feature": features,
    "Importance": model.feature_importances_
}).sort_values(
    "Importance",
    ascending=False
)

print("\nFeature Importance")
print(importance.to_string(index=False))

# ==========================================
# STEP 8: SAVE MODEL
# ==========================================

joblib.dump(model, "stock_prediction_model.pkl")

print("\nModel saved successfully!")
print("File: stock_prediction_model.pkl")
print("Stocks used:", data["Ticker"].nunique())
print("Features:", features)

print("\nTraining completed successfully.")
print("=" * 60)