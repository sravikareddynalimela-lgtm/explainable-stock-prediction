"""Train the model from the command line.

    python train.py                 # live Yahoo data (default universe)
    python train.py AAPL MSFT TSLA  # custom universe
    DATA_SOURCE=demo python train.py   # offline smoke test with simulated prices
"""
import json
import logging
import sys

from app import model

logging.basicConfig(level=logging.INFO, format="%(message)s")

if __name__ == "__main__":
    symbols = [s.upper() for s in sys.argv[1:]] or None
    m = model.train(symbols)
    o = m["overall"]
    print(json.dumps({
        "rows": m["rows"],
        "test_period": f"{o['testStart']} to {o['testEnd']}",
        "accuracy": round(o["accuracy"], 4),
        "baseline": round(o["baseline"], 4),
        "auc": round(o["auc"], 4),
        "high_conviction_accuracy": round(o["highConviction"]["accuracy"], 4),
        "top_features": [f["label"] for f in m["featureImportance"][:5]],
    }, indent=2))
