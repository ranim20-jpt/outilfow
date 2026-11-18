# Jeu de données ML — OutilFlow (Quincaillerie Bochtiba)

> **Données synthétiques.** Le catalogue (211 articles, 13 catégories, prix) est réel : il vient de
> `quincaillerie_projet.sql`. Les clients, commandes, livraisons et mouvements de stock sont **simulés**
> avec des règles réalistes, car la plateforme n'a pas encore d'historique. Dans ton rapport, écris
> « jeu de données synthétique généré à partir du catalogue réel de la quincaillerie », jamais « données réelles ».

Période simulée : du 2024-01-01 au 2026-10-25 (147 semaines, 1 029 jours).
Les fichiers CSV du dataset se trouvent dans le sous-dossier `data/`.

Reproductible depuis la racine du projet (dépendances : numpy, pandas) :
```bash
npm run ml:generate
# ou : python ml/generer_dataset.py --seed 42 --catalogue prisma/catalogue.json --out ml/data
```
Les paramètres (nombre de clients, taux d'échec visé, politique de réapprovisionnement…) sont en haut de `generer_dataset.py`.

## Fichiers

Les CSV sont dans `data/` :

| Fichier | Lignes | Contenu |
| --- | --- | --- |
| `data/clients.csv` | 510 | 420 particuliers et 90 professionnels |
| `data/produits.csv` | 211 | Catalogue réel + prix de gros, quantité minimale de gros, unité, poids estimé |
| `data/commandes.csv` | 13 200 | Une ligne par commande |
| `data/lignes_commande.csv` | 32 223 | Articles de chaque commande (prix et tarif appliqués) |
| `data/livraisons.csv` | 8 643 | Une ligne par commande livrée à domicile (le reste est en retrait magasin) |
| `data/ventes_hebdo_produit.csv` | 29 638 | Série hebdomadaire par produit (203 produits vendables) avec cibles prêtes |
| `data/ventes_journalieres.csv` | 1 029 | Série journalière globale (commandes, chiffre d'affaires, météo) |

Scripts et docs dans `ml/` : `generer_dataset.py` (génération), `ml_reference.py` (baselines ML), `requirements.txt` (dépendances Python), `README.md`.

### Baselines (modèles de référence)

Installer les dépendances puis lancer l'entraînement/évaluation (coupe chronologique 80/20, sans fuite) :

```bash
npm run ml:install
npm run ml:train                      # toutes les tâches
npm run ml:train:echec                # prédiction échec de livraison
npm run ml:train:rupture              # prédiction rupture de stock
npm run ml:train:demande              # prévision demande hebdomadaire
npm run ml:train:ca                   # prévision CA journalier
# export des métriques : python ml/ml_reference.py --out-dir ml/resultats
```

> Les scores de référence attendus sont listés plus bas. Si l'import de `numpy/pandas/scikit-learn` échoue sur votre machine (ex. blocage DLL par une stratégie Windows), utilisez un environnement Python autorisé (venv/conda) ou exécutez ces scripts sur un autre poste/Colab avec les mêmes fichiers `ml/`.

Liens entre tables : `commandes.client_id → clients`, `lignes_commande.commande_id → commandes`,
`lignes_commande.produit_id → produits`, `livraisons.commande_id → commandes`.

## Dictionnaire des colonnes

**clients.csv** : `client_id`, `type_client` (PARTICULIER / PROFESSIONNEL), `metier` (professionnels : plombier, électricien, maçon, peintre, artisan, entrepreneur, entreprise de construction), `gouvernorat`, `distance_magasin_km`, `date_inscription` (peut précéder 2024 : base existante), `nb_employes` (professionnels seulement).

**produits.csv** : `produit_id`, `code_stq`, `nom`, `categorie_id`, `categorie`, `prix_detail` et `prix_gros` (DT, HTVA ; vides pour les 8 articles sans prix), `quantite_min_gros`, `unite`, `poids_kg_estime`, `prix_non_specifie`.

**commandes.csv** : `commande_id`, `client_id`, `date_commande`, `jour_semaine` (0 = lundi), `heure_commande`, `type_vente` (GROS si au moins une ligne au prix de gros), `mode_recuperation` (RETRAIT / LIVRAISON), `nb_lignes`, `nb_articles`, `poids_total_kg`, `sous_total`, `frais_livraison` (7 DT si livraison, sinon 0), `total`.

**lignes_commande.csv** : `ligne_id`, `commande_id`, `produit_id`, `quantite`, `prix_unitaire`, `tarif` (DETAIL / GROS), `sous_total`.
Règle appliquée comme dans l'application : prix de gros uniquement pour un professionnel dont la quantité atteint `quantite_min_gros`.

**livraisons.csv** : `livraison_id`, `commande_id`, `client_id`, `livreur_id` (1 à 4), `gouvernorat`, `distance_km`, `adresse_verifiee` (0/1), `frais_livraison`, `nb_articles`, `poids_total_kg`, `jour_semaine`, `heure_commande`, `temperature_c`, `pluie_mm`, `nb_echecs_precedents_client`, `date_affectation`, `date_livraison`, `duree_livraison_min`, `statut_final` (LIVREE / ECHEC), **`echec`** (cible, 0/1), `motif_echec`.

**ventes_hebdo_produit.csv** : `semaine_debut` (lundi), `produit_id`, `categorie_id`, `mois`, `semaine_iso`, `prix_detail`, `quantite_min_gros`, `seuil_alerte` (seuil de réapprovisionnement), `quantite_vendue`, `nb_commandes`, `ca_ht`, `stock_debut_semaine`, `stock_fin_semaine`, `jours_rupture` (jours de la semaine finis avec stock à 0), `rupture_semaine`, `reappro_recu`, `temperature_moy`, `pluie_totale_mm`, `jours_ramadan`, et les deux cibles : **`quantite_vendue_semaine_suivante`** et **`rupture_semaine_suivante`**.

**ventes_journalieres.csv** : `date`, `jour_semaine`, `mois`, `ramadan` (0/1), `temperature_c`, `pluie_mm`, `nb_commandes`, `nb_commandes_gros`, `nb_livraisons`, `ca_total` (DT).

## Tâches ML possibles

| Tâche | Fichier | Cible | Idées de variables |
| --- | --- | --- | --- |
| Prévoir la demande de la semaine suivante | `ventes_hebdo_produit` | `quantite_vendue_semaine_suivante` (régression) | retards (lags) et moyennes glissantes de `quantite_vendue`, mois, météo, Ramadan, catégorie |
| Prédire une rupture de stock | `ventes_hebdo_produit` | `rupture_semaine_suivante` (classification) | `stock_fin_semaine`, `seuil_alerte`, ventes récentes, `reappro_recu` |
| Prévoir le chiffre d'affaires | `ventes_journalieres` | `ca_total` (série temporelle) | jour de la semaine, retards à 7 jours, moyenne sur 28 jours, Ramadan |
| Prédire l'échec d'une livraison | `livraisons` | `echec` (classification) | distance, adresse vérifiée, heure, pluie, livreur, échecs précédents |
| Segmenter les clients | `commandes` + `clients` | aucune (clustering) | RFM : récence, fréquence, montant |
| Recommander des produits | `lignes_commande` | paniers (règles d'association, filtrage collaboratif) | co-achats, catégorie, type de client |

## Pièges à éviter (fuite de données)

- **Séries temporelles : coupe chronologique.** Entraîne sur les premières semaines, teste sur les dernières (par exemple 80 % / 20 %). Un découpage aléatoire donnerait des scores trop beaux.
- **Échec de livraison** : n'utilise pas `motif_echec`, `date_livraison`, `duree_livraison_min` ni `statut_final` comme variables. Ces informations n'existent qu'après la livraison.
- **Prévisions hebdomadaires** : les colonnes `quantite_vendue_semaine_suivante` et `rupture_semaine_suivante` sont les cibles. Ne les mets jamais dans les variables d'entrée.
- **Ventes censurées** : quand un produit est en rupture, les ventes perdues ne sont pas enregistrées. Les ventes observées sous-estiment alors la demande réelle.
- Beaucoup de produits se vendent peu : 47 % des lignes hebdomadaires ont 0 vente. Une métrique comme la MAE doit être comparée à une base naïve (« même quantité que la semaine précédente »).

## Scores de référence (HistGradientBoosting, coupe chronologique 80/20)

Ils servent à vérifier que tu obtiens des résultats cohérents avec ta propre préparation des données.

| Tâche | Modèle | Base de comparaison |
| --- | --- | --- |
| Échec de livraison | AUC 0,72 | distance seule : AUC 0,70 |
| Rupture de stock | AUC 0,84 (précision moyenne 0,44) | `stock_fin_semaine` seul : AUC 0,74 |
| Demande hebdomadaire | MAE 17,8 | semaine précédente : 23,7 ; moyenne 4 semaines : 19,2 |
| CA journalier | MAE 1 384 DT | même jour de la semaine précédente : 1 750 DT |

## Règles de simulation (à citer dans le rapport)

- **Clients** : les professionnels commandent plus souvent (environ 3,5 commandes par mois contre 0,35 pour les particuliers) et en plus grandes quantités. Leur métier influence les catégories achetées (par exemple, les plombiers achètent surtout du cuivre et du laiton).
- **Saisonnalité** : moustiquaires au printemps, tuyaux d'arrosage en été, baisse de 22 % des ventes pendant le Ramadan, baisse en août, très peu de commandes le dimanche.
- **Achats associés** : 45 % des articles suivants d'un panier viennent de la même catégorie ou de la même famille de produit.
- **Prix** : prix de gros = 85 % du prix de détail ; quantité minimale de gros : 50 si prix < 5 DT, 20 si < 20 DT, sinon 10 (mêmes valeurs que le seed de l'application).
- **Stock** : un réapprovisionnement est commandé quand le stock descend à 10 jours de demande, pour un lot de 45 jours, avec un délai fournisseur aléatoire de 2 à 14 jours. C'est ce qui produit les ruptures.
- **Livraison** : frais fixes de 7 DT. Le magasin est supposé dans le Grand Tunis (hypothèse), d'où les distances par gouvernorat. Le taux d'échec est calibré à 7 %. Il augmente avec la distance, une adresse non vérifiée, une commande tardive, la pluie, le samedi, les échecs précédents du client, et selon le livreur.
- Météo simulée (température et pluie selon la saison). Dates du Ramadan : 2024-03-11 au 04-09, 2025-03-01 au 03-30, 2026-02-18 au 03-19.
