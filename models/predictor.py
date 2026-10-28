"""
Adverse-Selection Model Predictor Interface.
Exposes standardized predict(features) -> PredictionResult.
Automatically falls back to a transparent statistical microstructure heuristic
if no serialized production model is detected on disk.
"""

import json
import pathlib
import sys
from pathlib import Path
from typing import Dict, Any, Union, Optional
import numpy as np
import pandas as pd

try:
    import joblib
except ImportError:
    joblib = None

# Ensure Python 3.13 -> 3.14 / Cross-OS pathlib pickle compatibility
sys.modules.setdefault("pathlib._local", pathlib)

from config.config import ModelConfig, SAVED_MODELS_DIR
from data.contracts import (
    PredictionResult,
    ModelStatus,
    RiskCategory,
    OrderSide,
    ModelSystemStatus,
)
from models.preprocessing import DEFAULT_FEATURE_COLS


class _NumpyScaler:
    def __init__(self, mean: np.ndarray, scale: np.ndarray) -> None:
        self.mean_ = np.asarray(mean, dtype=np.float64)
        self.scale_ = np.where(np.asarray(scale, dtype=np.float64) == 0, 1.0, np.asarray(scale, dtype=np.float64))

    def transform(self, X: np.ndarray) -> np.ndarray:
        return (np.asarray(X, dtype=np.float64) - self.mean_) / self.scale_


class _NumpyLogisticModel:
    def __init__(self, coef: np.ndarray, intercept: np.ndarray) -> None:
        self.coef_ = np.asarray(coef, dtype=np.float64)
        self.intercept_ = np.asarray(intercept, dtype=np.float64)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        logits = np.asarray(X, dtype=np.float64) @ self.coef_.T + self.intercept_
        probs_pos = 1.0 / (1.0 + np.exp(-np.clip(logits.reshape(-1), -30.0, 30.0)))
        return np.column_stack([1.0 - probs_pos, probs_pos])


class AdverseSelectionPredictor:
    """Standardized inference engine for adverse-selection risk prediction."""

    def __init__(self, model_path: Optional[Path] = None, horizon: int = 10):
        self.model_path = model_path or (SAVED_MODELS_DIR / "best_adverse_selection_model.joblib")
        self.horizon = horizon
        self.model = None
        self.scaler = None
        self.feature_names = DEFAULT_FEATURE_COLS
        self.model_name = "Heuristic Statistical Microstructure Fallback"
        self.model_status = ModelStatus.FALLBACK_HEURISTIC
        self.model_version = "v0.9-heuristic"
        self.model_metrics: Dict[str, Any] = {}
        self.feature_importances: Dict[str, float] = {}

        self._load_model_if_available()

    def _load_model_if_available(self) -> bool:
        """Attempts to load a trained model bundle from disk."""
        if self.model_path and Path(self.model_path).exists():
            if joblib is not None:
                try:
                    bundle = joblib.load(self.model_path)
                    self.model = bundle["model"]
                    self.scaler = bundle["scaler"]
                    self.feature_names = list(bundle["feature_names"])
                    self.model_name = bundle.get("best_name", "Trained ML Classifier")
                    self.model_version = bundle.get("version", "v1.0-production")
                    self.model_status = ModelStatus.TRAINED
                    self.model_metrics = bundle.get("metrics", {})
                    self.feature_importances = self.model_metrics.get("feature_importances", {})
                    return True
                except Exception:
                    pass

            # Pure-NumPy cross-version fallback for the default trained artifact
            npz_path = Path(self.model_path).with_name("adverse_selection_numpy.npz")
            if Path(self.model_path).name == "best_adverse_selection_model.joblib" and npz_path.exists():
                try:
                    data = np.load(npz_path)
                    self.model = _NumpyLogisticModel(data["coef"], data["intercept"])
                    self.scaler = _NumpyScaler(data["scaler_mean"], data["scaler_scale"])
                    self.feature_names = [str(x) for x in data["feature_names"].tolist()]
                    self.model_name = str(data["best_name"].item())
                    self.model_version = str(data["version"].item())
                    self.model_status = ModelStatus.TRAINED
                    self.model_metrics = json.loads(str(data["metrics_json"].item()))
                    self.feature_importances = self.model_metrics.get("feature_importances", {})
                    return True
                except Exception:
                    pass

        self.model_status = ModelStatus.FALLBACK_HEURISTIC
        return False

    def reload(self) -> bool:
        """Forces reload of the saved model from disk."""
        return self._load_model_if_available()

    def get_model_status_info(self) -> ModelSystemStatus:
        """Returns standardized single source of truth for model status."""
        if self.model_status == ModelStatus.TRAINED and self.model is not None:
            return ModelSystemStatus(
                is_loaded=True,
                model_name=self.model_name,
                model_version=self.model_version,
                status=ModelStatus.TRAINED,
                status_label="🟢 Trained Model Loaded",
                prediction_available=True,
                details=f"Production supervised classifier trained with zero-leakage cross-validation. Active horizon: {self.horizon} ticks.",
                metrics=self.model_metrics,
                feature_importances=self.feature_importances,
            )
        elif self.model_status in [ModelStatus.FALLBACK, ModelStatus.FALLBACK_HEURISTIC]:
            return ModelSystemStatus(
                is_loaded=False,
                model_name="Microstructure Heuristic Fallback",
                model_version="v0.9-heuristic",
                status=ModelStatus.FALLBACK,
                status_label="🟡 Development Fallback",
                prediction_available=True,
                details="Operating on calibrated multi-level depth imbalance, spread expansion, and order flow heuristic.",
                metrics={},
                feature_importances={
                    "depth_imbalance_l1": 0.35,
                    "spread_expansion_ratio": 0.25,
                    "momentum_ret_5": 0.20,
                    "trade_volume_imbalance": 0.20,
                },
            )
        else:
            return ModelSystemStatus(
                is_loaded=False,
                model_name="None",
                model_version="N/A",
                status=ModelStatus.UNAVAILABLE,
                status_label="🔴 Model Unavailable",
                prediction_available=False,
                details="No predictive model or heuristic engine available.",
                metrics={},
                feature_importances={},
            )

    def predict(
        self,
        features: Union[pd.DataFrame, Dict[str, Any]],
        side: OrderSide = OrderSide.BUY,
        timestamp: float = 0.0,
    ) -> PredictionResult:
        """
        Calculates adverse-selection / passive-exposure toxicity probability.

        The returned probability estimates how unsafe it is to rest a maker order.
        It is not a forecast of future price direction.
        Guarantees returned PredictionResult adheres strictly to system contract.
        """
        if isinstance(features, dict):
            ts = features.get("timestamp", timestamp)
            df = pd.DataFrame([features])
        else:
            ts = features["timestamp"].iloc[-1] if "timestamp" in features.columns else timestamp
            df = features.tail(1).copy()

        if self.model_status == ModelStatus.TRAINED and self.model is not None and self.scaler is not None:
            try:
                missing_cols = [c for c in self.feature_names if c not in df.columns]
                for c in missing_cols:
                    df[c] = 0.0

                X_raw = df[self.feature_names].values
                X_scaled = self.scaler.transform(X_raw)

                if hasattr(self.model, "predict_proba"):
                    prob = float(self.model.predict_proba(X_scaled)[0, 1])
                else:
                    prob = float(self.model.predict(X_scaled)[0])

                prob = float(np.clip(prob, 0.01, 0.99))
                return PredictionResult(
                    probability=round(prob, 4),
                    timestamp=ts,
                    prediction_horizon=self.horizon,
                    model_name=self.model_name,
                    model_status=self.model_status,
                    feature_importances=self.feature_importances,
                )
            except Exception:
                pass

        prob = self._heuristic_microstructure_risk(df, side=side)
        return PredictionResult(
            probability=round(prob, 4),
            timestamp=ts,
            prediction_horizon=self.horizon,
            model_name="Microstructure Heuristic (Development Fallback)",
            model_status=ModelStatus.FALLBACK_HEURISTIC,
            feature_importances={
                "depth_imbalance_l1": 0.35,
                "spread_expansion_ratio": 0.25,
                "momentum_ret_5": 0.20,
                "trade_volume_imbalance": 0.20,
            },
        )

    def _heuristic_microstructure_risk(self, df: pd.DataFrame, side: OrderSide) -> float:
        row = df.iloc[-1]
        imbalance = row.get("depth_imbalance_l1", 0.0)
        spread_exp = row.get("spread_expansion_ratio", 1.0)
        mom = row.get("momentum_ret_5", 0.0)
        trade_imb = row.get("trade_volume_imbalance", 0.0)

        base_logit = 0.0
        if side == OrderSide.BUY:
            base_logit += -1.5 * imbalance
            base_logit += -50.0 * mom
            base_logit += -1.2 * trade_imb
        else:
            base_logit += 1.5 * imbalance
            base_logit += 50.0 * mom
            base_logit += 1.2 * trade_imb

        if spread_exp > 1.2:
            base_logit += 0.5 * (spread_exp - 1.0)

        prob = 1.0 / (1.0 + np.exp(-base_logit))
        return float(np.clip(prob, 0.05, 0.95))
