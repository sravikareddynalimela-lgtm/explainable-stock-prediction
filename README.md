
# Explainable Multi-Agent Stock Market Prediction System

## 1. Project Overview
The Explainable Multi-Agent Stock Market Prediction System is a machine-learning-based application that predicts the next available trading day's stock price direction as **UP** or **DOWN**. It provides a confidence score, a BUY/SELL/HOLD recommendation, and explanations to help users understand the prediction.

The system combines technical, volatility, and historical analysis with a Random Forest classification model. A Streamlit dashboard presents the results in an interactive format.

## 2. Objectives
- Predict stock price direction using historical market data.
- Analyze stocks using technical and historical indicators.
- Incorporate multiple analytical agents.
- Display prediction confidence and a simple recommendation.
- Explain model predictions using feature importance and SHAP.
- Provide an interactive dashboard for stock analysis.

## 3. Main Modules
- **Technical Analysis Agent:** Uses indicators such as RSI, SMA, and MACD.
- **Volatility Agent:** Calculates rolling volatility and identifies risk levels.
- **Historical Analysis Agent:** Examines moving averages and historical returns.
- **Agent Fusion Module:** Combines agent outputs and generates the dataset used for model training.
- **Prediction Model:** Trains a Random Forest classifier to predict stock direction.
- **Explainability Module:** Displays feature importance and SHAP explanations.
- **Streamlit Dashboard:** Allows users to select stocks and view predictions, charts, and explanations.

## 4. Technologies Used
- Python
- Streamlit
- yfinance
- pandas and NumPy
- scikit-learn
- ta
- joblib
- SHAP
- Matplotlib

## 5. Supported Stocks
The project currently includes:
- AAPL
- MSFT
- GOOGL
- NVDA
- RELIANCE.NS
- TCS.NS

Market data is retrieved using yfinance. Availability and completeness depend on the data provider.

## 6. Model Features
The Random Forest model uses the following features:
- RSI
- SMA_20
- MACD
- Volatility
- SMA_5
- Historical_Return

The target is based on whether the next available trading row's closing price is higher than the current row's closing price.

## 7. Prediction and Recommendation
The model predicts **UP** or **DOWN** and displays its prediction confidence.

The recommendation uses a 60% confidence threshold:
- **BUY:** UP prediction with confidence of at least 60%.
- **SELL:** DOWN prediction with confidence of at least 60%.
- **HOLD:** Confidence below 60%.

These recommendations are for educational demonstration only.

## 8. Project Structure
```text
stockmarketprediction/
├── app.py
├── agent_fusion.py
├── prediction_model.py
├── stock_prediction_model.pkl
├── fused_stock_data.csv
├── requirements.txt
├── stock_data.py
├── historical_agent.py
├── volatility_agent.py
├── predict_latest.py
├── shap_explain.py
└── test.py
```

## 9. Installation
1. Install Python and Visual Studio Code.
2. Open the project folder in Visual Studio Code.
3. Create and activate a virtual environment:

   ```powershell
   python -m venv venv
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
   .\venv\Scripts\Activate.ps1
   ```

4. Install the required packages:

   ```powershell
   pip install -r requirements.txt
   ```

## 10. Running the Project
If the dataset and trained model are already available, start the dashboard:

```powershell
streamlit run app.py
```

To regenerate the dataset and train the model:

```powershell
python agent_fusion.py
python prediction_model.py
```

Then launch the dashboard:

```powershell
streamlit run app.py
```

The dashboard will open in a browser. Select a stock to view its prediction, confidence, recommendation, price chart, feature importance, and SHAP explanation.

## 11. Model Evaluation
The current trained model achieved approximately **53.58% accuracy**, compared with a majority-class baseline of approximately **52.56%** on the chronological test set.

These results indicate modest improvement over the baseline. Performance may vary with market conditions and updated data.

## 12. Disclaimer
This project is developed for academic and educational purposes only. Predictions and recommendations are not financial advice and should not be used as the sole basis for investment decisions. Stock markets involve risk, and model predictions are uncertain.
