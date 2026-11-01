import streamlit as st
import yfinance as yf
import ta
import joblib
import shap
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

# =========================
# PAGE CONFIGURATION
# =========================
st.set_page_config(
    page_title="Stock Market Prediction",
    page_icon="📈",
    layout="wide"
)

# =========================
# SIDEBAR
# =========================
st.sidebar.title("📈 Project Information")

st.sidebar.markdown("""
### 🤖 About the Project

This system combines a trained Random Forest model
with three specialized analysis agents.

### 📊 Technical Agent
Analyzes RSI, MACD and moving averages.

### ⚡ Volatility Agent
Measures price fluctuations and market risk.

### 📈 Historical Agent
Analyzes recent returns and price trends.

### 🔗 Agent Fusion
Combines model and agent signals.

### 🔍 Explainable AI
SHAP explains how individual features contribute
to the Random Forest prediction.

---

⚠️ **Disclaimer**

This project is for educational purposes only.
Predictions are not financial advice.
""")

# =========================
# MAIN PAGE
# =========================
st.title("📈 Explainable Multi-Agent Stock Market Prediction System")

st.write(
    "Predict stock movement using Technical, Volatility "
    "and Historical Analysis Agents, with SHAP explanations."
)

# =========================
# STOCK SELECTION
# =========================
st.subheader("📈 Select a Stock")

stock_options = {
    "Apple": "AAPL",
    "Microsoft": "MSFT",
    "Google": "GOOGL",
    "NVIDIA": "NVDA",
    "Tesla": "TSLA",
    "Amazon": "AMZN",
    "Reliance Industries": "RELIANCE.NS",
    "TCS": "TCS.NS",
    "Infosys": "INFY.NS",
    "HDFC Bank": "HDFCBANK.NS",
    "Other (Enter Symbol)": "OTHER"
}

selected_stock = st.selectbox(
    "Choose a company:",
    list(stock_options.keys())
)

if stock_options[selected_stock] == "OTHER":
    ticker = st.text_input(
        "Enter Stock Symbol:",
        "AAPL"
    ).strip().upper()
else:
    ticker = stock_options[selected_stock]

st.caption(f"Selected stock symbol: {ticker}")

# =========================
# PREDICTION
# =========================
if st.button("Predict Stock Movement"):

    try:
        if not ticker:
            st.error("Please enter a stock symbol.")
            st.stop()

        # =========================
        # LOAD TRAINED MODEL
        # =========================
        model = joblib.load("stock_prediction_model.pkl")

        # =========================
        # DOWNLOAD STOCK DATA
        # =========================
        with st.spinner("Downloading stock data..."):
            data = yf.download(
                ticker,
                period="6mo",
                progress=False
            )

        # Fix yfinance multi-level columns
        if not data.empty and data.columns.nlevels > 1:
            data.columns = data.columns.get_level_values(0)

        if data.empty:
            st.error(
                "Stock data not found. Please check the stock symbol."
            )
            st.stop()

        # =========================
        # TECHNICAL AGENT
        # =========================
        close = data["Close"].squeeze()

        data["RSI"] = ta.momentum.RSIIndicator(
            close
        ).rsi()

        data["SMA_20"] = close.rolling(
            window=20
        ).mean()

        data["MACD"] = ta.trend.MACD(
            close
        ).macd()

        # =========================
        # VOLATILITY AGENT
        # =========================
        data["Daily_Return"] = close.pct_change()

        data["Volatility"] = data["Daily_Return"].rolling(
            window=20
        ).std()

        # =========================
        # HISTORICAL AGENT
        # =========================
        data["SMA_5"] = close.rolling(
            window=5
        ).mean()

        data["Historical_Return"] = close.pct_change(
            periods=5
        )

        # Remove rows containing missing values
        data = data.dropna()

        if data.empty:
            st.error(
                "Not enough stock data to calculate indicators."
            )
            st.stop()

        # =========================
        # MODEL FEATURES
        # =========================
        features = [
            "RSI",
            "SMA_20",
            "MACD",
            "Volatility",
            "SMA_5",
            "Historical_Return"
        ]

        latest_data = data[features].iloc[[-1]]

        # =========================
        # RANDOM FOREST PREDICTION
        # =========================
        prediction = int(model.predict(latest_data)[0])

        probability = model.predict_proba(latest_data)[0]

        predicted_class_index = list(model.classes_).index(
            prediction
        )

        confidence = (
            probability[predicted_class_index] * 100
        )

        model_direction = (
            "UP" if prediction == 1 else "DOWN"
        )

        # =========================
        # LATEST STOCK INFORMATION
        # =========================
        st.subheader("💰 Latest Stock Information")

        latest_price = float(close.iloc[-1])
        highest_price = float(data["High"].iloc[-1])
        lowest_price = float(data["Low"].iloc[-1])
        latest_volume = int(data["Volume"].iloc[-1])

        col1, col2, col3, col4 = st.columns(4)

        col1.metric(
            "💰 Current Price",
            f"${latest_price:.2f}"
        )

        col2.metric(
            "📈 Latest High",
            f"${highest_price:.2f}"
        )

        col3.metric(
            "📉 Latest Low",
            f"${lowest_price:.2f}"
        )

        col4.metric(
            "📦 Volume",
            f"{latest_volume:,}"
        )

        # =========================
        # PREDICTION RESULT
        # =========================
        st.subheader("📊 Prediction Result")

        if prediction == 1:
            st.success("📈 Prediction: UP")
        else:
            st.error("📉 Prediction: DOWN")

        st.write(
            f"🎯 Model confidence: {confidence:.2f}%"
        )

        st.progress(
            min(int(confidence), 100)
        )

        st.caption(
            "Model confidence is not a guarantee of prediction accuracy."
        )

        # =========================
        # BUY / SELL / HOLD
        # =========================
        if prediction == 1 and confidence >= 60:
            recommendation = "BUY 🟢"
            reason = (
                "The model predicts an upward movement "
                "with confidence of 60% or more."
            )

        elif prediction == 0 and confidence >= 60:
            recommendation = "SELL 🔴"
            reason = (
                "The model predicts a downward movement "
                "with confidence of 60% or more."
            )

        else:
            recommendation = "HOLD 🟡"
            reason = (
                "The prediction confidence is below 60%, "
                "so the system recommends waiting."
            )

        st.subheader(
            f"💰 Recommendation: {recommendation}"
        )

        st.info(f"💡 Reason: {reason}")

        st.caption(
            "This is an educational rule-based recommendation, "
            "not a validated trading signal."
        )

        # =========================
        # MULTI-AGENT ANALYSIS
        # =========================
        st.subheader("🤖 Multi-Agent Analysis")

        col1, col2, col3 = st.columns(3)

        # -------------------------
        # TECHNICAL AGENT
        # -------------------------
        with col1:
            st.write("### 📊 Technical Agent")

            rsi_value = float(
                latest_data["RSI"].iloc[0]
            )

            macd_value = float(
                latest_data["MACD"].iloc[0]
            )

            sma20_value = float(
                latest_data["SMA_20"].iloc[0]
            )

            if rsi_value < 30 and macd_value > 0:
                technical_signal = "UP"
            elif rsi_value > 70 and macd_value < 0:
                technical_signal = "DOWN"
            elif macd_value > 0:
                technical_signal = "UP"
            elif macd_value < 0:
                technical_signal = "DOWN"
            else:
                technical_signal = "HOLD"

            st.write(f"RSI: {rsi_value:.2f}")
            st.write(f"MACD: {macd_value:.4f}")
            st.write(f"SMA 20: {sma20_value:.2f}")
            st.write(f"Signal: **{technical_signal}**")

        # -------------------------
        # VOLATILITY AGENT
        # -------------------------
        with col2:
            st.write("### ⚡ Volatility Agent")

            volatility_value = float(
                latest_data["Volatility"].iloc[0]
            )

            daily_return_value = float(
                data["Daily_Return"].iloc[-1]
            )

            if volatility_value >= 0.025:
                risk_level = "HIGH"
            elif volatility_value >= 0.015:
                risk_level = "MEDIUM"
            else:
                risk_level = "LOW"

            st.write(
                f"Volatility: {volatility_value:.4f}"
            )

            st.write(
                f"Daily Return: {daily_return_value * 100:.2f}%"
            )

            st.write(f"Risk Level: **{risk_level}**")

        # -------------------------
        # HISTORICAL AGENT
        # -------------------------
        with col3:
            st.write("### 📈 Historical Agent")

            sma5_value = float(
                latest_data["SMA_5"].iloc[0]
            )

            historical_return_value = float(
                latest_data["Historical_Return"].iloc[0]
            )

            if sma5_value > sma20_value:
                historical_signal = "UP"
            elif sma5_value < sma20_value:
                historical_signal = "DOWN"
            else:
                historical_signal = "HOLD"

            st.write(f"SMA 5: {sma5_value:.2f}")
            st.write(f"SMA 20: {sma20_value:.2f}")

            st.write(
                f"5-Day Return: {historical_return_value * 100:.2f}%"
            )

            st.write(
                f"Signal: **{historical_signal}**"
            )

        # =========================
        # AGENT FUSION
        # =========================
        st.subheader("🔗 Agent Fusion")

        signals = [
            model_direction,
            technical_signal,
            historical_signal
        ]

        up_votes = signals.count("UP")
        down_votes = signals.count("DOWN")

        if up_votes > down_votes:
            fusion_result = "UP"
        elif down_votes > up_votes:
            fusion_result = "DOWN"
        else:
            fusion_result = "HOLD"

        fusion_col1, fusion_col2, fusion_col3 = st.columns(3)

        fusion_col1.metric(
            "UP Votes",
            up_votes
        )

        fusion_col2.metric(
            "DOWN Votes",
            down_votes
        )

        fusion_col3.metric(
            "Fused Direction",
            fusion_result
        )

        st.write(
            f"Random Forest: **{model_direction}**"
        )

        st.write(
            f"Technical Agent: **{technical_signal}**"
        )

        st.write(
            f"Historical Agent: **{historical_signal}**"
        )

        st.caption(
            "Agent Fusion uses majority voting among the model, "
            "Technical Agent and Historical Agent. "
            "The Volatility Agent assesses risk separately."
        )

        # =========================
        # STOCK PRICE CHART
        # =========================
        st.subheader(
            "📈 Stock Price & Moving Average Chart"
        )

        chart_data = data[
            ["Close", "SMA_5", "SMA_20"]
        ].copy()

        chart_data.columns = [
            "Closing Price",
            "5-Day Moving Average",
            "20-Day Moving Average"
        ]

        st.line_chart(chart_data)

        # =========================
        # FEATURE IMPORTANCE
        # =========================
        st.subheader("📊 Feature Importance")

        importance_df = pd.DataFrame({
            "Feature": features,
            "Importance": model.feature_importances_
        })

        importance_df = importance_df.sort_values(
            by="Importance",
            ascending=False
        )

        importance_df["Importance (%)"] = (
            importance_df["Importance"] * 100
        ).round(2)

        st.dataframe(
            importance_df[
                ["Feature", "Importance (%)"]
            ],
            use_container_width=True,
            hide_index=True
        )

        st.bar_chart(
            importance_df.set_index(
                "Feature"
            )["Importance (%)"]
        )

        st.caption(
            "Feature Importance shows overall model reliance. "
            "It does not explain an individual prediction."
        )

        # =========================
        # SHAP EXPLAINABILITY
        # =========================
        st.subheader(
            "🔍 Why Did the Random Forest Make This Prediction?"
        )

        st.write(
            "SHAP estimates how each feature contributes to "
            "this individual prediction relative to the model's "
            "baseline output."
        )

        with st.spinner("Calculating SHAP explanation..."):

            # TreeExplainer for the trained Random Forest
            explainer = shap.TreeExplainer(model)

            # Explain the latest selected-stock input
            shap_explanation = explainer(latest_data)

            shap_array = np.asarray(
                shap_explanation.values
            )

        # Determine the predicted class index
        class_index = list(model.classes_).index(
            prediction
        )

        # SHAP 0.52 binary classifier output:
        # (samples, features, classes)
        if shap_array.ndim == 3:
            shap_for_prediction = shap_array[
                0, :, class_index
            ]

        elif shap_array.ndim == 2:
            shap_for_prediction = shap_array[0, :]

        else:
            raise ValueError(
                f"Unexpected SHAP output shape: {shap_array.shape}"
            )

        # =========================
        # SHAP CONTRIBUTION TABLE
        # =========================
        shap_df = pd.DataFrame({
            "Feature": features,
            "Feature Value": latest_data.iloc[0].to_numpy(),
            "SHAP Value": shap_for_prediction
        })

        shap_df["Absolute SHAP Value"] = (
            shap_df["SHAP Value"].abs()
        )

        shap_df = shap_df.sort_values(
            by="Absolute SHAP Value",
            ascending=False
        )

        st.write(
            f"### 🎯 Explanation for the {model_direction} Prediction"
        )

        st.write(
            "Positive SHAP values support the predicted class. "
            "Negative SHAP values oppose the predicted class."
        )

        st.dataframe(
            shap_df[
                ["Feature", "Feature Value", "SHAP Value"]
            ].round(6),
            use_container_width=True,
            hide_index=True
        )

        # =========================
        # TOP 3 SHAP FACTORS
        # =========================
        st.write("### 🔍 Top 3 Influential Features")

        top3_df = shap_df.head(3).copy()

        st.dataframe(
            top3_df[
                ["Feature", "Feature Value", "SHAP Value"]
            ].round(6),
            use_container_width=True,
            hide_index=True
        )

        # =========================
        # SHAP CONTRIBUTION CHART
        # =========================
        st.subheader(
            "📊 SHAP Contributions for This Prediction"
        )

        plot_df = shap_df.sort_values(
            by="SHAP Value",
            ascending=True
        )

        fig, ax = plt.subplots(figsize=(9, 5))

        ax.barh(
            plot_df["Feature"],
            plot_df["SHAP Value"]
        )

        ax.axvline(
            x=0,
            linewidth=1
        )

        ax.set_xlabel(
            "SHAP Value for Predicted Class"
        )

        ax.set_ylabel("Feature")

        ax.set_title(
            f"Feature Contributions to {model_direction} Prediction"
        )

        plt.tight_layout()

        st.pyplot(fig)

        plt.close(fig)

        # =========================
        # NATURAL LANGUAGE EXPLANATION
        # =========================
        strongest = shap_df.iloc[0]

        if strongest["SHAP Value"] > 0:
            explanation_text = (
                f"**{strongest['Feature']}** has the largest "
                f"absolute SHAP contribution and supports the "
                f"model's **{model_direction}** prediction."
            )

        elif strongest["SHAP Value"] < 0:
            explanation_text = (
                f"**{strongest['Feature']}** has the largest "
                f"absolute SHAP contribution and opposes the "
                f"model's **{model_direction}** prediction."
            )

        else:
            explanation_text = (
                "The SHAP contributions are zero for this sample."
            )

        st.info(explanation_text)

        st.caption(
            "SHAP explains the Random Forest model's output, "
            "not the rule-based agents. Contributions describe "
            "model behavior and do not establish causation or "
            "guarantee future stock movement."
        )

        # =========================
        # RECENT STOCK DATA
        # =========================
        with st.expander("📋 View Recent Stock Data"):
            st.dataframe(
                data.tail(10),
                use_container_width=True
            )

    except Exception as e:
        st.error(
            f"An error occurred while processing the prediction: {e}"
        )
