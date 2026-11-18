#!/usr/bin/env python3
"""
Génère le jeu de données SYNTHÉTIQUE pour la partie Machine Learning du projet OutilFlow
(Quincaillerie Bochtiba).

- Le catalogue (211 articles, 13 catégories, prix) est RÉEL : il vient de quincaillerie_projet.sql.
- Tout le reste (clients, commandes, livraisons, stock) est SIMULÉ avec des règles réalistes
  (saisonnalité, métiers des professionnels, ruptures de stock, échecs de livraison...).
- Les règles de gestion sont celles de l'application : prix de gros pour les professionnels dès la
  quantité minimale, livraison avec frais fixes de 7 DT, etc.

Utilisation :  python3 generer_dataset.py [--seed 42] [--catalogue catalogue.json] [--out .]
Dépendances :  numpy, pandas
"""
import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------------------
# Paramètres (modifiables)
# --------------------------------------------------------------------------------------
DATE_DEBUT = pd.Timestamp("2024-01-01")  # un lundi
DATE_FIN = pd.Timestamp("2026-10-25")    # un dimanche -> 147 semaines complètes
N_PARTICULIERS = 420
N_PROFESSIONNELS = 90
FRAIS_LIVRAISON = 7.0                    # DT, comme dans l'application
TAUX_ECHEC_CIBLE = 0.07                  # taux moyen d'échec de livraison visé
N_LIVREURS = 4
# Politique de réapprovisionnement : on commande quand le stock <= SEUIL_JOURS jours de demande,
# pour un lot de LOT_JOURS jours de demande ; le fournisseur livre en 2 à 14 jours (aléatoire).
SEUIL_JOURS = 10
LOT_JOURS = 45

# Le magasin est supposé situé dans le Grand Tunis (hypothèse de simulation)
GOUVERNORATS = {
    # nom: (distance moyenne au magasin en km, poids de population)
    "Tunis": (9, 0.20), "Ariana": (13, 0.12), "Ben Arous": (15, 0.12), "Manouba": (17, 0.05),
    "Nabeul": (65, 0.09), "Bizerte": (65, 0.06), "Zaghouan": (55, 0.02), "Béja": (105, 0.03),
    "Sousse": (140, 0.09), "Monastir": (160, 0.05), "Kairouan": (155, 0.04), "Sfax": (270, 0.13),
}

METIERS = ["plombier", "électricien", "maçon", "peintre", "artisan", "entrepreneur",
           "entreprise de construction"]
METIERS_P = [0.22, 0.14, 0.17, 0.12, 0.14, 0.11, 0.10]

# Affinité profil -> catégorie (id catégorie du catalogue) ; 0.3 par défaut
AFFINITE = {
    "particulier": {2: 1.5, 3: 0.7, 7: 1.4, 8: 1.5, 9: 1.5, 10: 0.8, 11: 1.8, 12: 1.6, 5: 0.6, 13: 0.6,
                    1: 0.6, 6: 0.4, 4: 0.5},
    "plombier": {5: 3.0, 13: 2.8, 4: 2.0, 12: 1.5, 8: 1.0, 2: 0.3},
    "électricien": {3: 1.5, 8: 1.2, 12: 0.8, 9: 0.6, 4: 0.5, 2: 0.4},
    "maçon": {2: 2.0, 3: 2.2, 8: 2.5, 12: 1.5, 9: 0.8, 6: 0.3},
    "peintre": {2: 3.0, 8: 2.0, 11: 0.8, 3: 0.5},
    "artisan": {1: 2.5, 6: 2.5, 7: 2.2, 9: 2.2, 10: 1.2, 8: 1.5, 11: 1.2},
    "entrepreneur": {8: 1.5, 9: 1.3, 6: 1.2, 1: 1.2, 12: 1.2, 5: 1.0, 2: 1.0, 3: 1.2, 7: 1.0, 13: 0.8,
                     4: 0.8, 11: 1.0},
    "entreprise de construction": {8: 2.5, 3: 2.0, 2: 1.5, 12: 1.8, 9: 1.5, 6: 1.5, 1: 1.2, 5: 1.0,
                                   13: 1.0, 4: 1.0},
}
AFFINITE_DEFAUT = {"particulier": 0.3, "plombier": 0.15, "électricien": 0.2, "maçon": 0.2, "peintre": 0.15,
                   "artisan": 0.2, "entrepreneur": 0.5, "entreprise de construction": 0.4}

# Saisonnalité par catégorie : (amplitude, mois du pic)
SAISON = {11: (0.8, 5.5), 12: (0.6, 7.0), 5: (0.25, 12.0), 13: (0.2, 12.0), 1: (0.25, 4.0), 6: (0.25, 4.0)}
SAISON_DEFAUT = (0.1, 6.0)

# Poids estimé d'une unité (kg) par catégorie (sert au calcul du poids d'une livraison)
POIDS_KG = {1: 3.5, 2: 0.25, 3: 0.8, 4: 0.6, 5: 0.15, 6: 2.5, 7: 0.5, 8: 0.1, 9: 0.6, 10: 0.1,
            11: 2.0, 12: 6.0, 13: 0.4}

RAMADAN = [("2024-03-11", "2024-04-09"), ("2025-03-01", "2025-03-30"), ("2026-02-18", "2026-03-19")]

DESIGNATIONS_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]


def round3(x):
    return float(np.round(x, 3))


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


# --------------------------------------------------------------------------------------
# 1. Catalogue
# --------------------------------------------------------------------------------------
def charger_produits(chemin, rng):
    data = json.load(open(chemin, encoding="utf-8"))
    cats = {c["id"]: c["nom"] for c in data["categories"]}
    lignes = []
    for a in data["articles"]:
        prix = a["prixHtva"]
        if prix is None:
            qmin = 10
        else:
            qmin = 50 if prix < 5 else 20 if prix < 20 else 10
        nom = a["libelle"]
        unite = "paquet" if "PAQUET" in nom else "paire" if nom.startswith("GANT") else "pièce"
        lignes.append({
            "produit_id": a["id"], "code_stq": a["codeStq"], "nom": nom,
            "categorie_id": a["categorieId"], "categorie": cats[a["categorieId"]],
            "prix_detail": prix,
            "prix_gros": None if prix is None else round3(prix * 0.85),
            "quantite_min_gros": qmin, "unite": unite,
            "poids_kg_estime": POIDS_KG[a["categorieId"]],
            "prix_non_specifie": int(prix is None),
        })
    df = pd.DataFrame(lignes)
    # popularité latente (non exportée) : quelques articles se vendent beaucoup plus que les autres
    df["_pop"] = rng.lognormal(0.0, 0.9, len(df))
    return df


# --------------------------------------------------------------------------------------
# 2. Calendrier / météo
# --------------------------------------------------------------------------------------
def construire_calendrier(rng):
    jours = pd.date_range(DATE_DEBUT, DATE_FIN, freq="D")
    cal = pd.DataFrame({"date": jours})
    doy = cal["date"].dt.dayofyear.values
    mois = cal["date"].dt.month.values
    cal["jour_semaine"] = cal["date"].dt.dayofweek
    cal["mois"] = mois
    cal["temperature_c"] = np.round(18 + 9 * np.sin(2 * np.pi * (doy - 110) / 365) + rng.normal(0, 2.5, len(cal)), 1)
    p_pluie = 0.16 + 0.14 * np.cos(2 * np.pi * (mois - 12.5) / 12)  # plus de pluie de novembre à mars
    pluie = np.where(rng.random(len(cal)) < p_pluie, rng.exponential(6.0, len(cal)), 0.0)
    cal["pluie_mm"] = np.round(pluie, 1)
    cal["ramadan"] = 0
    for d1, d2 in RAMADAN:
        cal.loc[(cal["date"] >= d1) & (cal["date"] <= d2), "ramadan"] = 1
    return cal


def facteur_saison(cat_id, jour):
    amp, pic = SAISON.get(cat_id, SAISON_DEFAUT)
    m = jour.month - 1 + jour.day / 30.0 + 1  # mois fractionnaire (1 = janvier)
    return max(0.2, 1 + amp * math.cos(2 * math.pi * (m - pic) / 12))


# --------------------------------------------------------------------------------------
# 3. Clients
# --------------------------------------------------------------------------------------
def generer_clients(rng):
    noms_g = list(GOUVERNORATS)
    p_g = np.array([GOUVERNORATS[g][1] for g in noms_g])
    p_g = p_g / p_g.sum()
    lignes = []
    n_total = N_PARTICULIERS + N_PROFESSIONNELS
    for i in range(n_total):
        pro = i >= N_PARTICULIERS
        gouv = rng.choice(noms_g, p=p_g)
        dist = max(1.0, GOUVERNORATS[gouv][0] * rng.lognormal(0, 0.25))
        # 60 % de la base existe dès le début de la période, le reste s'inscrit ensuite
        if rng.random() < 0.6:
            ins = DATE_DEBUT - pd.Timedelta(days=int(rng.integers(30, 700)))
        else:
            ins = DATE_DEBUT + pd.Timedelta(days=int(rng.integers(0, (DATE_FIN - DATE_DEBUT).days - 30)))
        metier = rng.choice(METIERS, p=METIERS_P) if pro else None
        activite = rng.lognormal(0, 0.6) if pro else rng.lognormal(0, 0.7)
        lignes.append({
            "client_id": i + 1,
            "type_client": "PROFESSIONNEL" if pro else "PARTICULIER",
            "metier": metier,
            "gouvernorat": gouv,
            "distance_magasin_km": round(dist, 1),
            "date_inscription": ins.date().isoformat(),
            "nb_employes": (int(np.clip(round(activite * rng.lognormal(1.0, 0.5)), 1, 150)) if pro else None),
            "_activite": activite,
            "_freq_mois": (3.5 if pro else 0.35) * activite,
            "_adresse_fiable": rng.random() > (0.03 if pro else 0.10),
        })
    return pd.DataFrame(lignes)


# --------------------------------------------------------------------------------------
# 4. Commandes (demande non contrainte par le stock)
# --------------------------------------------------------------------------------------
def tirer_quantite(prix, pro, activite, rng):
    if pro:
        base = 25 if prix < 5 else 10 if prix < 20 else 3
        return 1 + rng.poisson(base * activite)
    base = 2.0 if prix < 5 else 0.6
    return 1 + rng.poisson(base)


def generer_demande(clients, produits, cal, rng):
    vendables = produits[produits["prix_detail"].notna()].reset_index(drop=True)
    cat_ids = vendables["categorie_id"].values
    prix = vendables["prix_detail"].values
    pop = vendables["_pop"].values
    pids = vendables["produit_id"].values
    nom_famille = vendables["nom"].str.split().str[:2].str.join(" ").values

    def profil(c):
        return c["metier"] if c["type_client"] == "PROFESSIONNEL" else "particulier"

    # poids de base par profil (sans saison) -> évite de recalculer à chaque commande
    base_w = {}
    for prof in AFFINITE:
        aff = np.array([AFFINITE[prof].get(c, AFFINITE_DEFAUT[prof]) for c in cat_ids])
        base_w[prof] = aff * pop

    ins = pd.to_datetime(clients["date_inscription"]).values
    freq = clients["_freq_mois"].values
    est_pro = (clients["type_client"] == "PROFESSIONNEL").values
    commandes = []
    for _, jour in cal.iterrows():
        d = jour["date"]
        wd = jour["jour_semaine"]
        f_sem_part = [1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.35][wd]
        f_sem_pro = [1.2, 1.2, 1.2, 1.2, 1.1, 0.7, 0.1][wd]
        f_saison_globale = (0.78 if jour["ramadan"] else 1.0) * (0.8 if d.month == 8 else 1.0)
        actif = ins <= np.datetime64(d)
        p = freq / 30.4 * f_saison_globale * np.where(est_pro, f_sem_pro, f_sem_part) * actif
        qui = np.nonzero(rng.random(len(clients)) < p)[0]
        if len(qui) == 0:
            continue
        sais = np.array([facteur_saison(c, d) for c in range(14)])  # index = id catégorie
        for ci in qui:
            c = clients.iloc[ci]
            prof = profil(c)
            pro = bool(est_pro[ci])
            w = base_w[prof] * sais[cat_ids]
            n_lignes = int(min(10 if pro else 5, 1 + rng.poisson(2.2 if pro else 0.7)))
            choisis = []
            for k in range(n_lignes):
                if choisis and rng.random() < 0.45:
                    # achat associé : même catégorie (ou même famille de produit) qu'une ligne précédente
                    ref = choisis[rng.integers(len(choisis))]
                    if rng.random() < 0.35:
                        masque = nom_famille == nom_famille[ref]
                    else:
                        masque = cat_ids == cat_ids[ref]
                    ww = w * masque
                    if ww.sum() == 0:
                        ww = w
                else:
                    ww = w
                idx = int(rng.choice(len(vendables), p=ww / ww.sum()))
                if idx in choisis:
                    continue
                choisis.append(idx)
            if pro:
                h = float(np.clip(rng.normal(8.5, 2.2), 6, 20))
            else:
                h = float(np.clip(rng.choice([rng.normal(10.5, 1.8), rng.normal(20, 1.8)], p=[0.6, 0.4]), 7, 23.5))
            heure = int(h)
            minute = int(rng.integers(0, 60))
            lignes = [{"produit_id": int(pids[i]), "quantite": int(tirer_quantite(prix[i], pro, c["_activite"], rng))}
                      for i in choisis]
            mode_p = 0.6 if pro else 0.45
            if c["distance_magasin_km"] > 100:
                mode_p = 0.9 if pro else 0.75
            commandes.append({
                "client_id": int(c["client_id"]), "date": d, "heure": heure, "minute": minute,
                "mode": "LIVRAISON" if rng.random() < mode_p else "RETRAIT", "lignes": lignes,
            })
    return commandes


# --------------------------------------------------------------------------------------
# 5. Simulation du stock (ruptures, réapprovisionnements, ventes perdues)
# --------------------------------------------------------------------------------------
def simuler_stock(commandes, produits, cal, rng):
    nj = len(cal)
    jour_index = {d: i for i, d in enumerate(cal["date"])}
    demande = defaultdict(float)
    for c in commandes:
        for l in c["lignes"]:
            demande[l["produit_id"]] += l["quantite"]
    d_moy = {pid: demande.get(pid, 0.0) / nj for pid in produits["produit_id"]}

    seuil = {pid: max(5, math.ceil(d * SEUIL_JOURS)) for pid, d in d_moy.items()}
    lot = {pid: max(20, math.ceil(d * LOT_JOURS)) for pid, d in d_moy.items()}
    prix_par_id = produits.set_index("produit_id")["prix_detail"].to_dict()
    # stock initial ~ 60 jours de demande ; articles sans prix : jamais en stock
    stock = {pid: (int(round(d * 60 * rng.uniform(0.5, 1.5))) + 5 if not pd.isna(prix_par_id[pid]) else 0)
             for pid, d in d_moy.items()}
    pids = list(produits["produit_id"])
    pos = {pid: i for i, pid in enumerate(pids)}
    stock_fin = np.zeros((nj, len(pids)), dtype=np.int32)
    recu = np.zeros((nj, len(pids)), dtype=np.int32)
    arrivees = defaultdict(list)
    en_cours = set()

    par_jour = defaultdict(list)
    for c in commandes:
        par_jour[jour_index[c["date"]]].append(c)

    for j in range(nj):
        for pid, q in arrivees.pop(j, []):
            stock[pid] += q
            recu[j, pos[pid]] += q
            en_cours.discard(pid)
        for c in sorted(par_jour.get(j, []), key=lambda x: (x["heure"], x["minute"])):
            nouvelles = []
            for l in c["lignes"]:
                dispo = stock[l["produit_id"]]
                prise = min(l["quantite"], dispo)
                if prise > 0:
                    stock[l["produit_id"]] -= prise
                    nouvelles.append({"produit_id": l["produit_id"], "quantite": prise})
            c["lignes"] = nouvelles
        for pid in pids:
            if d_moy[pid] > 0 and stock[pid] <= seuil[pid] and pid not in en_cours:
                delai = int(rng.choice([2, 3, 4, 5, 7, 10, 14], p=[0.15, 0.25, 0.2, 0.15, 0.12, 0.08, 0.05]))
                en_cours.add(pid)
                arrivees[j + delai].append((pid, int(lot[pid] * rng.uniform(0.8, 1.2))))
        for pid in pids:
            stock_fin[j, pos[pid]] = stock[pid]
    return [c for c in commandes if c["lignes"]], stock_fin, recu, seuil, pids


# --------------------------------------------------------------------------------------
# 6. Tables finales (commandes, lignes, livraisons)
# --------------------------------------------------------------------------------------
def construire_tables(commandes, clients, produits, cal, rng):
    prod = produits.set_index("produit_id")
    cli = clients.set_index("client_id")
    commandes = sorted(commandes, key=lambda c: (c["date"], c["heure"], c["minute"]))
    cal_i = cal.set_index("date")

    rows_cmd, rows_lig, rows_liv = [], [], []
    ligne_id = 0
    echecs_precedents = defaultdict(int)
    # livreurs : effet individuel sur le risque d'échec
    effet_livreur = np.array([-0.4, -0.1, 0.2, 0.5])

    # 1) construire commandes et lignes (prix recalculés avec les quantités réellement servies)
    liv_pending = []
    for i, c in enumerate(commandes, start=1):
        client = cli.loc[c["client_id"]]
        pro = client["type_client"] == "PROFESSIONNEL"
        sous_total, nb_art, poids, a_gros = 0.0, 0, 0.0, False
        for l in c["lignes"]:
            p = prod.loc[l["produit_id"]]
            gros = bool(pro and l["quantite"] >= p["quantite_min_gros"])
            pu = p["prix_gros"] if gros else p["prix_detail"]
            st = round3(pu * l["quantite"])
            ligne_id += 1
            rows_lig.append({"ligne_id": ligne_id, "commande_id": i, "produit_id": l["produit_id"],
                             "quantite": l["quantite"], "prix_unitaire": pu,
                             "tarif": "GROS" if gros else "DETAIL", "sous_total": st})
            sous_total += st
            nb_art += l["quantite"]
            poids += l["quantite"] * p["poids_kg_estime"]
            a_gros = a_gros or gros
        livraison = c["mode"] == "LIVRAISON"
        frais = FRAIS_LIVRAISON if livraison else 0.0
        dt_cmd = c["date"] + pd.Timedelta(hours=c["heure"], minutes=c["minute"])
        rows_cmd.append({
            "commande_id": i, "client_id": c["client_id"], "date_commande": dt_cmd.isoformat(sep=" "),
            "jour_semaine": c["date"].dayofweek, "heure_commande": c["heure"],
            "type_vente": "GROS" if a_gros else "DETAIL", "mode_recuperation": c["mode"],
            "nb_lignes": len(c["lignes"]), "nb_articles": nb_art, "poids_total_kg": round(poids, 1),
            "sous_total": round3(sous_total), "frais_livraison": frais, "total": round3(sous_total + frais),
        })
        if livraison:
            liv_pending.append((i, c, client, pro, dt_cmd, nb_art, poids))

    # 2) calibrage de l'intercept du modèle d'échec pour atteindre le taux visé
    feats = []
    for (i, c, client, pro, dt_cmd, nb_art, poids) in liv_pending:
        pluie = float(cal_i.loc[pd.Timestamp(c["date"]), "pluie_mm"])
        feats.append((client["distance_magasin_km"], pluie, c["heure"], c["date"].dayofweek, nb_art, pro,
                      bool(client["_adresse_fiable"])))

    def logit_base(f, nb_prec, effet):
        dist, pluie, heure, wd, nb_art, pro, fiable = f
        z = 0.5 * math.log1p(dist / 10.0)
        z += 0.0 if fiable else 1.2
        z += 0.5 * min(nb_prec, 3)
        z += 0.35 if heure >= 18 else 0.0
        z += 0.3 if wd == 5 else 0.0
        z += min(0.06 * pluie, 0.9)
        z += 0.2 if nb_art > 20 else 0.0
        z += -0.25 if pro else 0.0
        return z + effet

    # tirages fixés à l'avance (livreur et aléa de l'échec) pour que le calibrage et la simulation
    # finale donnent exactement le même taux d'échec, y compris l'effet des échecs précédents
    n_liv = len(liv_pending)
    livreurs = rng.integers(N_LIVREURS, size=n_liv)
    aleas = rng.random(n_liv)

    def taux_echec(intercept):
        prec = defaultdict(int)
        n_echecs = 0
        for k, ((_, c, *_), f) in enumerate(zip(liv_pending, feats)):
            cid = int(c["client_id"])
            z = logit_base(f, prec[cid], effet_livreur[livreurs[k]]) + intercept
            if aleas[k] < sigmoid(z):
                prec[cid] += 1
                n_echecs += 1
        return n_echecs / max(n_liv, 1)

    lo, hi = -10.0, 3.0
    for _ in range(30):
        mid = (lo + hi) / 2
        if taux_echec(mid) > TAUX_ECHEC_CIBLE:
            hi = mid
        else:
            lo = mid
    intercept = (lo + hi) / 2

    # 3) simulation chronologique des livraisons
    liv_id = 0
    for k, ((i, c, client, pro, dt_cmd, nb_art, poids), f) in enumerate(zip(liv_pending, feats)):
        liv_id += 1
        cid = int(c["client_id"])
        dist, pluie, heure, wd, _, _, fiable = f
        livreur = int(livreurs[k])
        z = logit_base(f, echecs_precedents[cid], effet_livreur[livreur]) + intercept
        echec = bool(aleas[k] < sigmoid(z))
        if echec:
            echecs_precedents[cid] += 1
        delai_aff = float(rng.exponential(60 + (40 if heure >= 17 else 0)))
        dt_aff = dt_cmd + pd.Timedelta(minutes=delai_aff)
        duree = (25 + dist * 1.4) * rng.lognormal(0, 0.25) * (1 + 0.02 * pluie)
        dt_liv = dt_aff + pd.Timedelta(minutes=float(duree))
        if heure >= 17:  # commande tardive -> tournée du lendemain matin
            dt_liv = (dt_cmd.normalize() + pd.Timedelta(days=1, hours=9)) + pd.Timedelta(minutes=float(duree))
        if dt_liv.dayofweek == 6:
            dt_liv += pd.Timedelta(days=1)
        motif = None
        if echec:
            if not fiable:
                motif = rng.choice(["adresse introuvable", "client injoignable"], p=[0.75, 0.25])
            else:
                motif = rng.choice(["client absent", "client injoignable", "livraison refusée", "adresse introuvable"],
                                   p=[0.5, 0.25, 0.1, 0.15])
        dj = pd.Timestamp(c["date"])
        rows_liv.append({
            "livraison_id": liv_id, "commande_id": i, "client_id": cid, "livreur_id": livreur + 1,
            "gouvernorat": client["gouvernorat"], "distance_km": client["distance_magasin_km"],
            "adresse_verifiee": int(fiable), "frais_livraison": FRAIS_LIVRAISON,
            "nb_articles": nb_art, "poids_total_kg": round(poids, 1),
            "jour_semaine": dj.dayofweek, "heure_commande": c["heure"],
            "temperature_c": float(cal_i.loc[dj, "temperature_c"]), "pluie_mm": pluie,
            "nb_echecs_precedents_client": echecs_precedents[cid] - (1 if echec else 0),
            "date_affectation": dt_aff.isoformat(sep=" ", timespec="minutes"),
            "date_livraison": None if echec else dt_liv.isoformat(sep=" ", timespec="minutes"),
            "duree_livraison_min": None if echec else int(round(duree)),
            "statut_final": "ECHEC" if echec else "LIVREE", "echec": int(echec), "motif_echec": motif,
        })
    return pd.DataFrame(rows_cmd), pd.DataFrame(rows_lig), pd.DataFrame(rows_liv)


# --------------------------------------------------------------------------------------
# 7. Séries hebdomadaires par produit et séries journalières globales
# --------------------------------------------------------------------------------------
def tables_series(cmd, lig, produits, cal, stock_fin, recu, seuil, pids):
    nj = len(cal)
    nsem = nj // 7
    sem_idx = np.arange(nj) // 7
    lignes = lig.merge(cmd[["commande_id", "date_commande"]], on="commande_id")
    lignes["jour"] = ((pd.to_datetime(lignes["date_commande"]).dt.normalize() - DATE_DEBUT).dt.days).astype(int)
    lignes["sem"] = lignes["jour"] // 7
    agg = lignes.groupby(["sem", "produit_id"]).agg(
        quantite_vendue=("quantite", "sum"), nb_commandes=("commande_id", "nunique"),
        ca_ht=("sous_total", "sum")).reset_index()

    meteo = cal.assign(sem=sem_idx).groupby("sem").agg(
        temperature_moy=("temperature_c", "mean"), pluie_totale_mm=("pluie_mm", "sum"),
        jours_ramadan=("ramadan", "sum")).reset_index()
    prod = produits.set_index("produit_id")

    rows = []
    for k, pid in enumerate(pids):
        if np.isnan(prod.loc[pid, "prix_detail"]):
            continue
        for s in range(nsem):
            j0, j1 = s * 7, s * 7 + 6
            rows.append((s, pid, int(stock_fin[j0 - 1, k]) if j0 > 0 else int(stock_fin[0, k]),
                         int(stock_fin[j1, k]), int((stock_fin[j0:j1 + 1, k] == 0).sum()),
                         int(recu[j0:j1 + 1, k].sum())))
    h = pd.DataFrame(rows, columns=["sem", "produit_id", "stock_debut_semaine", "stock_fin_semaine",
                                    "jours_rupture", "reappro_recu"])
    h = h.merge(agg, on=["sem", "produit_id"], how="left").merge(meteo, on="sem")
    for col in ["quantite_vendue", "nb_commandes", "ca_ht"]:
        h[col] = h[col].fillna(0)
    h["quantite_vendue"] = h["quantite_vendue"].astype(int)
    h["nb_commandes"] = h["nb_commandes"].astype(int)
    h["ca_ht"] = h["ca_ht"].round(3)
    h["semaine_debut"] = (DATE_DEBUT + pd.to_timedelta(h["sem"] * 7, unit="D")).dt.date.astype(str)
    sd = pd.to_datetime(h["semaine_debut"])
    h["mois"] = sd.dt.month
    h["semaine_iso"] = sd.dt.isocalendar().week.astype(int)
    h["rupture_semaine"] = (h["jours_rupture"] > 0).astype(int)
    h["categorie_id"] = h["produit_id"].map(prod["categorie_id"])
    h["prix_detail"] = h["produit_id"].map(prod["prix_detail"])
    h["quantite_min_gros"] = h["produit_id"].map(prod["quantite_min_gros"])
    h["seuil_alerte"] = h["produit_id"].map(seuil)
    h["temperature_moy"] = h["temperature_moy"].round(1)
    h["pluie_totale_mm"] = h["pluie_totale_mm"].round(1)
    h = h.sort_values(["produit_id", "sem"]).reset_index(drop=True)
    g = h.groupby("produit_id")
    h["quantite_vendue_semaine_suivante"] = g["quantite_vendue"].shift(-1)
    h["rupture_semaine_suivante"] = g["rupture_semaine"].shift(-1)
    h = h.dropna(subset=["quantite_vendue_semaine_suivante"]).copy()
    h["quantite_vendue_semaine_suivante"] = h["quantite_vendue_semaine_suivante"].astype(int)
    h["rupture_semaine_suivante"] = h["rupture_semaine_suivante"].astype(int)
    h = h[["semaine_debut", "produit_id", "categorie_id", "mois", "semaine_iso", "prix_detail", "quantite_min_gros",
           "seuil_alerte", "quantite_vendue", "nb_commandes", "ca_ht", "stock_debut_semaine",
           "stock_fin_semaine", "jours_rupture", "rupture_semaine", "reappro_recu", "temperature_moy",
           "pluie_totale_mm", "jours_ramadan", "quantite_vendue_semaine_suivante", "rupture_semaine_suivante"]]

    # série journalière globale (chiffre d'affaires, nombre de commandes)
    c = cmd.copy()
    c["date"] = pd.to_datetime(c["date_commande"]).dt.normalize()
    jour = c.groupby("date").agg(nb_commandes=("commande_id", "count"), ca_total=("total", "sum"),
                                 nb_commandes_gros=("type_vente", lambda s: int((s == "GROS").sum())),
                                 nb_livraisons=("mode_recuperation", lambda s: int((s == "LIVRAISON").sum()))
                                 ).reset_index()
    d = cal.merge(jour, on="date", how="left")
    for col in ["nb_commandes", "ca_total", "nb_commandes_gros", "nb_livraisons"]:
        d[col] = d[col].fillna(0)
    d["ca_total"] = d["ca_total"].round(3)
    for col in ["nb_commandes", "nb_commandes_gros", "nb_livraisons"]:
        d[col] = d[col].astype(int)
    d["date"] = d["date"].dt.date.astype(str)
    d = d[["date", "jour_semaine", "mois", "ramadan", "temperature_c", "pluie_mm", "nb_commandes",
           "nb_commandes_gros", "nb_livraisons", "ca_total"]]
    return h, d


# --------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--catalogue", default=str(Path(__file__).with_name("catalogue.json")))
    ap.add_argument("--out", default=str(Path(__file__).parent))
    a = ap.parse_args()
    rng = np.random.default_rng(a.seed)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    produits = charger_produits(a.catalogue, rng)
    cal = construire_calendrier(rng)
    clients = generer_clients(rng)
    demande = generer_demande(clients, produits, cal, rng)
    commandes, stock_fin, recu, seuil, pids = simuler_stock(demande, produits, cal, rng)
    cmd, lig, liv = construire_tables(commandes, clients, produits, cal, rng)
    hebdo, jour = tables_series(cmd, lig, produits, cal, stock_fin, recu, seuil, pids)

    clients_out = clients[["client_id", "type_client", "metier", "gouvernorat", "distance_magasin_km",
                           "date_inscription", "nb_employes"]].copy()
    clients_out["nb_employes"] = clients_out["nb_employes"].astype("Int64")
    produits_out = produits.drop(columns=["_pop"])

    kw = dict(index=False, encoding="utf-8")
    clients_out.to_csv(out / "clients.csv", **kw)
    produits_out.to_csv(out / "produits.csv", **kw)
    cmd.to_csv(out / "commandes.csv", **kw)
    lig.to_csv(out / "lignes_commande.csv", **kw)
    liv.to_csv(out / "livraisons.csv", **kw)
    hebdo.to_csv(out / "ventes_hebdo_produit.csv", **kw)
    jour.to_csv(out / "ventes_journalieres.csv", **kw)
    print(f"clients={len(clients_out)} produits={len(produits_out)} commandes={len(cmd)} lignes={len(lig)} "
          f"livraisons={len(liv)} hebdo={len(hebdo)} jours={len(jour)}")


if __name__ == "__main__":
    main()
