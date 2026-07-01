from __future__ import annotations

from pathlib import Path
import re

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor


BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = BASE_DIR / "data" / "datasets"
MODEL_PATH = BASE_DIR / "data" / "models" / "duration_model.pkl"


def main() -> None:
    dataset_path = _find_dataset(DATASET_DIR)
    df = pd.read_csv(dataset_path, encoding="cp1252")

    df = df.copy()
    df["HoursActual"] = pd.to_numeric(df.get("HoursActual"), errors="coerce")
    df = df.dropna(subset=["HoursActual"])
    df = df[df["HoursActual"] > 0]
    df = df[df["HoursActual"] <= 80]

    df["HoursEstimate"] = pd.to_numeric(df.get("HoursEstimate"), errors="coerce").fillna(0)

    df["task_type"] = df.apply(_infer_task_type, axis=1)
    df["description"] = _pick_column(df, ["Description", "TaskDescription", "Summary", "Title"]).fillna("")
    df["description_words"] = df["description"].apply(_word_count)
    df["skills_count"] = _pick_column(df, ["SkillsRequired", "Skills", "RequiredSkills"]).fillna("").apply(_skills_count)
    df["experience"] = _pick_column(df, ["AssigneeExperience", "Experience", "AssigneeLevel"]).fillna("mid")

    X = np.column_stack(
        [
            df["task_type"].map(_task_type_to_value).astype(float),
            df["description_words"].astype(float),
            df["skills_count"].astype(float),
            df["experience"].map(_experience_to_value).astype(float),
            df["HoursEstimate"].astype(float),
        ]
    )
    y = df["HoursActual"].astype(float).to_numpy()

    # XGBoost handles non-linear interactions in tabular feature sets well.
    model = XGBRegressor(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


def _find_dataset(dataset_dir: Path) -> Path:
    preferred = dataset_dir / "SiP_dataset.csv"
    if preferred.exists():
        return preferred
    csv_files = list(dataset_dir.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError("No CSV dataset found in backend/data/datasets")
    return csv_files[0]


def _pick_column(df: pd.DataFrame, candidates: list[str]) -> pd.Series:
    for name in candidates:
        if name in df.columns:
            return df[name]
    return pd.Series([None] * len(df))


def _infer_task_type(row: pd.Series) -> str:
    subcategory = str(row.get("SubCategory", "")).strip().lower()
    mapping = {
        "enhancement": "feature",
        "bug": "bugfix",
        "in house support": "other",
    }
    if subcategory in mapping:
        return mapping[subcategory]

    raw_type = str(row.get("TaskType", "")).strip().lower()
    if raw_type:
        return raw_type

    category = str(row.get("Category", "")).strip().lower()
    return category or "other"


def _task_type_to_value(task_type: str) -> int:
    mapping = {
        "feature": 0,
        "bugfix": 1,
        "documentation": 2,
        "research": 3,
        "other": 4,
    }
    return mapping.get(task_type.lower(), 4)


def _experience_to_value(exp: str) -> int:
    return {"junior": 0, "mid": 1, "senior": 2}.get(str(exp).lower(), 1)


def _word_count(text: str) -> int:
    return len(str(text).split())


def _skills_count(text: str) -> int:
    if not text:
        return 0
    parts = re.split(r"[,;|/]+", str(text))
    return len([part for part in parts if part.strip()])


if __name__ == "__main__":
    main()
