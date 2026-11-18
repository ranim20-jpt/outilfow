#!/usr/bin/env python3
"""
Modèles de référence (baselines) pour la partie ML du projet OutilFlow.
Utilise le jeu de données synthétique présent dans ce dossier (sous-dossier data/).

Tâches (coupe chronologique 80/20, sans fuite de données) :
  1. Prédire l'échec d'une livraison            -> livraisons.csv            (AUC)
  2. Prédire une rupture de stock               -> ventes_hebdo_produit.csv   (AUC, AP)
  3. Prévoir la demande hebdomadaire            -> ventes_hebdo_produit.csv   (MAE)
  4. Prévoir le chiffre d'affaires journalier   -> ventes_journalieres.csv    (MAE)

Usage (depuis la racine du projet ou depuis ml/) :
  python ml/ml_reference.py
  python ml/ml_reference.py --tache echec_livraison
  python ml/ml_reference.py --out-dir ml/resultats

Dépendances: numpy, pandas, scikit-learn (voir requirements.txt)
"""
from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    average_precision_score,
    mean_absolute_error,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

warnings.filterwarnings("ignore", category=UserWarning)

HERE = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = HERE / "data"
RANDOM_STATE = 42


def chrono_split(df: pd.DataFrame, sort_col: str, ratio: float = 0.8):
    df = df.sort_values(sort_col).reset_index(drop=True)
    cut = int(len(df) * ratio)
    return df.iloc[:cut].copy(), df.iloc[cut:].copy()


def chrono_split_by_time(df: pd.DataFrame, time_col: str, ratio: float = 0.8):
    """Coupe sur le temps global (toutes entités confondues) : train = premières dates."""
    times = np.sort(df[time_col].unique())
    cut_time = times[int(len(times) * ratio) - 1]
    train = df[df[time_col] <= cut_time].copy()
    test = df[df[time_col] > cut_time].copy()
    return train, test


def make_preprocessor(num_cols, cat_cols):
    transformers = []
    if num_cols:
        transformers.append(("num", SimpleImputer(strategy="median"), num_cols))
    if cat_cols:
        transformers.append(
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("enc", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
                    ]
                ),
                cat_cols,
            )
        )
    return ColumnTransformer(transformers, remainder="drop")


def fit_classifier(X_train, y_train, num_cols, cat_cols):
    model = Pipeline(
        [
            ("prep", make_preprocessor(num_cols, cat_cols)),
            ("clf", HistGradientBoostingClassifier(random_state=RANDOM_STATE, max_depth=6)),
        ]
    )
    model.fit(X_train, y_train)
    return model


def fit_regressor(X_train, y_train, num_cols, cat_cols):
    model = Pipeline(
        [
            ("prep", make_preprocessor(num_cols, cat_cols)),
            ("reg", HistGradientBoostingRegressor(random_state=RANDOM_STATE, max_depth=6)),
        ]
    )
    model.fit(X_train, y_train)
    return model


# ---------------------------------------------------------------------------
# 1. Échec de livraison (classification)
# ---------------------------------------------------------------------------

def tache_echec_livraison(data_dir: Path):
    df = pd.read_csv(data_dir / "livraisons.csv")
    df["date_affectation"] = pd.to_datetime(df["date_affectation"])
    train, test = chrono_split(df, "date_affectation", 0.8)

    target = "echec"
    num_cols = [
        "distance_km",
        "adresse_verifiee",
        "nb_articles",
        "poids_total_kg",
        "jour_semaine",
        "heure_commande",
        "temperature_c",
        "pluie_mm",
        "nb_echecs_precedents_client",
        "frais_livraison",
    ]
    cat_cols = ["gouvernorat", "livreur_id"]

    X_train, y_train = train[num_cols + cat_cols], train[target]
    X_test, y_test = test[num_cols + cat_cols], test[target]

    model = fit_classifier(X_train, y_train, num_cols, cat_cols)
    proba = model.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, proba)

    base_auc = roc_auc_score(y_test, test["distance_km"].values)

    return {
        "tache": "echec_livraison",
        "fichier": "data/livraisons.csv",
        "cible": target,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "auc_modele": round(float(auc), 4),
        "auc_baseline_distance_seule": round(float(base_auc), 4),
        "reference_readme_auc": 0.72,
    }


# ---------------------------------------------------------------------------
# 2. Rupture de stock semaine suivante (classification)
# ---------------------------------------------------------------------------

def tache_rupture_stock(data_dir: Path):
    df = pd.read_csv(data_dir / "ventes_hebdo_produit.csv")
    df["semaine_debut"] = pd.to_datetime(df["semaine_debut"])
    train, test = chrono_split_by_time(df, "semaine_debut", 0.8)

    target = "rupture_semaine_suivante"
    num_cols = [
        "mois",
        "semaine_iso",
        "prix_detail",
        "quantite_min_gros",
        "seuil_alerte",
        "quantite_vendue",
        "nb_commandes",
        "ca_ht",
        "stock_debut_semaine",
        "stock_fin_semaine",
        "jours_rupture",
        "rupture_semaine",
        "reappro_recu",
        "temperature_moy",
        "pluie_totale_mm",
        "jours_ramadan",
    ]
    cat_cols = ["categorie_id", "produit_id"]

    model = fit_classifier(train[num_cols + cat_cols], train[target], num_cols, cat_cols)
    proba = model.predict_proba(test[num_cols + cat_cols])[:, 1]
    auc = roc_auc_score(test[target], proba)
    ap = average_precision_score(test[target], proba)

    base_auc = roc_auc_score(test[target], -test["stock_fin_semaine"].values)

    return {
        "tache": "rupture_stock_semaine_suivante",
        "fichier": "data/ventes_hebdo_produit.csv",
        "cible": target,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "auc_modele": round(float(auc), 4),
        "average_precision_modele": round(float(ap), 4),
        "auc_baseline_stock_fin_semaine": round(float(base_auc), 4),
        "reference_readme_auc": 0.84,
        "reference_readme_ap": 0.44,
    }


# ---------------------------------------------------------------------------
# 3. Demande hebdomadaire (régression)
# ---------------------------------------------------------------------------

def ajouter_lags_hebdo(df: pd.DataFrame):
    df = df.sort_values(["produit_id", "semaine_debut"]).copy()
    g = df.groupby("produit_id")["quantite_vendue"]
    for lag in [1, 2, 3, 4]:
        df[f"lag_q_{lag}"] = g.shift(lag)
    df["moy_q_4"] = g.transform(lambda s: s.shift(1).rolling(4).mean())
    df["moy_q_8"] = g.transform(lambda s: s.shift(1).rolling(8).mean())
    df["delta_q_1_2"] = df["lag_q_1"] - df["lag_q_2"]
    return df


def tache_demande_hebdo(data_dir: Path):
    df = pd.read_csv(data_dir / "ventes_hebdo_produit.csv")
    df["semaine_debut"] = pd.to_datetime(df["semaine_debut"])
    df = ajouter_lags_hebdo(df)
    df = df.dropna(subset=["lag_q_4", "moy_q_4"]).copy()
    train, test = chrono_split_by_time(df, "semaine_debut", 0.8)

    target = "quantite_vendue_semaine_suivante"
    num_cols = [
        "mois",
        "semaine_iso",
        "prix_detail",
        "seuil_alerte",
        "quantite_vendue",
        "nb_commandes",
        "ca_ht",
        "stock_debut_semaine",
        "stock_fin_semaine",
        "jours_rupture",
        "rupture_semaine",
        "reappro_recu",
        "temperature_moy",
        "pluie_totale_mm",
        "jours_ramadan",
        "lag_q_1",
        "lag_q_2",
        "lag_q_3",
        "lag_q_4",
        "moy_q_4",
        "moy_q_8",
        "delta_q_1_2",
    ]
    cat_cols = ["categorie_id"]

    model = fit_regressor(train[num_cols + cat_cols], train[target], num_cols, cat_cols)
    pred = np.clip(model.predict(test[num_cols + cat_cols]), 0, None)
    mae = mean_absolute_error(test[target], pred)

    mae_naif_prev = mean_absolute_error(test[target], test["quantite_vendue"])
    mae_naif_moy4 = mean_absolute_error(test[target], test["moy_q_4"])

    return {
        "tache": "demande_hebdomadaire",
        "fichier": "data/ventes_hebdo_produit.csv",
        "cible": target,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "mae_modele": round(float(mae), 4),
        "mae_baseline_semaine_precedente": round(float(mae_naif_prev), 4),
        "mae_baseline_moyenne_4_semaines": round(float(mae_naif_moy4), 4),
        "reference_readme_mae": 17.8,
    }


# ---------------------------------------------------------------------------
# 4. Chiffre d'affaires journalier (régression / série temporelle)
# ---------------------------------------------------------------------------

def tache_ca_journalier(data_dir: Path):
    df = pd.read_csv(data_dir / "ventes_journalieres.csv")
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)

    for lag in [1, 7, 14]:
        df[f"lag_ca_{lag}"] = df["ca_total"].shift(lag)
        df[f"lag_cmd_{lag}"] = df["nb_commandes"].shift(lag)
    df["moy_ca_7"] = df["ca_total"].shift(1).rolling(7).mean()
    df["moy_ca_28"] = df["ca_total"].shift(1).rolling(28).mean()
    df["moy_cmd_7"] = df["nb_commandes"].shift(1).rolling(7).mean()

    df = df.dropna(subset=["lag_ca_14", "moy_ca_28"]).copy()
    train, test = chrono_split(df, "date", 0.8)

    target = "ca_total"
    num_cols = [
        "jour_semaine",
        "mois",
        "ramadan",
        "temperature_c",
        "pluie_mm",
        "lag_ca_1",
        "lag_ca_7",
        "lag_ca_14",
        "lag_cmd_1",
        "lag_cmd_7",
        "lag_cmd_14",
        "moy_ca_7",
        "moy_ca_28",
        "moy_cmd_7",
    ]
    cat_cols = []

    model = fit_regressor(train[num_cols], train[target], num_cols, cat_cols)
    pred = np.clip(model.predict(test[num_cols]), 0, None)
    mae = mean_absolute_error(test[target], pred)
    mae_naif = mean_absolute_error(test[target], test["lag_ca_7"])

    return {
        "tache": "ca_journalier",
        "fichier": "data/ventes_journalieres.csv",
        "cible": target,
        "n_train": int(len(train)),
        "n_test": int(len(test)),
        "mae_modele_dt": round(float(mae), 3),
        "mae_baseline_meme_jour_semaine_precedente_dt": round(float(mae_naif), 3),
        "reference_readme_mae_dt": 1384.0,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

TACHES = {
    "echec_livraison": tache_echec_livraison,
    "rupture_stock": tache_rupture_stock,
    "demande_hebdo": tache_demande_hebdo,
    "ca_journalier": tache_ca_journalier,
}


def main():
    ap = argparse.ArgumentParser(description="Baselines ML OutilFlow")
    ap.add_argument("--tache", choices=list(TACHES) + ["toutes"], default="toutes")
    ap.add_argument(
        "--data-dir",
        default=str(DEFAULT_DATA_DIR),
        help="Dossier contenant les CSV (par défaut: ml/data)",
    )
    ap.add_argument("--out-dir", default=None, help="Dossier de sortie pour les métriques JSON")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        raise SystemExit(f"Dossier de données introuvable: {data_dir}")

    noms = list(TACHES) if args.tache == "toutes" else [args.tache]

    resultats = []
    for nom in noms:
        print(f"\n=== {nom} ===")
        try:
            res = TACHES[nom](data_dir)
        except Exception as e:
            res = {"tache": nom, "erreur": str(e)}
            print(f"Erreur: {e}")
        resultats.append(res)
        if "erreur" not in res:
            for k, v in res.items():
                print(f"  {k}: {v}")

    if args.out_dir:
        out = Path(args.out_dir)
        out.mkdir(parents=True, exist_ok=True)
        path = out / "metriques_reference.json"
        path.write_text(json.dumps(resultats, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nMétriques enregistrées dans: {path}")

    print("\nTerminé.")
    return resultats


if __name__ == "__main__":
    main()
