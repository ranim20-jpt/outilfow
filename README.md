# OutilFlow — Quincaillerie Bochtiba

Plateforme web de vente en gros et au détail, gestion des stocks, commandes et livraisons.
Next.js 15 (App Router, Server Actions) · TypeScript · Prisma 6 · SQLite · authentification JWT par rôles.

## Installation

Prérequis : Node.js 20 ou plus récent.

```bash
npm install            # installe les dépendances et génère le client Prisma
npm run setup          # crée la base SQLite (prisma db push) puis importe le catalogue (seed)
npm run dev            # http://localhost:3000
```

Le fichier `.env` contient `DATABASE_URL` et `AUTH_SECRET` (valeur de développement).
Avant un vrai déploiement, remplace `AUTH_SECRET` par une longue valeur aléatoire (`openssl rand -base64 32`).

> `npm run setup` (le seed) **réinitialise toute la base**. À n’utiliser qu’en développement.

## Comptes de démonstration

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Administrateur | admin@outilflow.tn | Admin123! |
| Livreur | livreur1@outilflow.tn | Livreur123! |
| Livreur | livreur2@outilflow.tn | Livreur123! |
| Client particulier | client@outilflow.tn | Client123! |
| Client professionnel | pro@outilflow.tn | Pro12345! |

## Fonctionnalités (selon le cahier des charges)

- **Utilisateurs** : inscription (particulier ou professionnel), connexion, profil, rôles, désactivation de comptes.
- **Catalogue** : 13 catégories et 211 articles importés de `quincaillerie_projet.sql`, recherche par nom, filtre par catégorie et par prix, tri, pagination.
- **Tarification automatique** : le prix de gros s’applique aux comptes professionnels dès que la quantité atteint la quantité minimale du produit (fonction `calculerPrix` dans `lib/pricing.ts`). Le panier indique combien d’unités manquent pour atteindre le prix de gros.
- **Stock** : décrémenté automatiquement à la validation de la commande, dans une transaction protégée contre les ventes concurrentes ; restitué en cas d’annulation ; notifications de stock faible et de rupture.
- **Panier et commandes** : quantités, retrait en magasin ou livraison (adresse et frais), historique des commandes.
- **Livraison** : 5 statuts (En attente, En préparation, En cours de livraison, Livrée, Échec de livraison) avec historique ; l’administrateur affecte un livreur ; le livreur ne voit et ne modifie que ses livraisons.
- **Administration** : tableau de bord (chiffre d’affaires, ventes détail et gros, compteurs, stock, meilleures ventes, stock faible, commandes en attente, livraisons en cours), CRUD produits et catégories, commandes, utilisateurs.

## Hypothèses à connaître

Le dump SQL fourni ne contient qu’un seul prix par article et aucun stock. Le seed ajoute donc des **valeurs de démonstration** :

- prix de gros = 85 % du prix de détail ;
- quantité minimale de gros : 50 si le prix est inférieur à 5 DT, 20 si inférieur à 20 DT, sinon 10 ;
- stock initial entre 20 et 99, avec quelques articles en stock faible ou en rupture pour la démonstration ;
- seuil d’alerte : 5 ;
- frais de livraison fixes : 7 DT (`FRAIS_LIVRAISON` dans `lib/constants.ts`) ;
- les prix du catalogue sont hors TVA (colonne `prix_htva_tnd`).

Données à corriger dans la source : 8 articles n’ont pas de prix (affichés « Sur demande », non commandables en ligne) et 4 lignes portent un code article en double (`code_en_double`). Le code `80190710020680` a 14 chiffres.

Modifie ces valeurs depuis l’espace administrateur (Produits) ou dans `prisma/seed.ts`.

## Structure

```
app/                    pages (App Router)
  actions/              Server Actions : auth, panier, admin, livreur
  admin/                tableau de bord, produits, commandes, utilisateurs
  livreur/              espace livreur
  produits/ panier/ commandes/ profil/ connexion/ inscription/
  components/           Header, Flash, StockBadge, ProduitForm, AdminNav
lib/                    auth (JWT), pricing, stock, livraison, panier, constantes
prisma/                 schema.prisma, seed.ts, catalogue.json (extrait du SQL)
middleware.ts           première barrière d’accès par rôle
```

Sécurité : mots de passe hachés (bcrypt), session JWT en cookie httpOnly, rôle vérifié dans le middleware **et** dans chaque page et action serveur.

## Passer à MySQL / MariaDB (XAMPP)

Dans `prisma/schema.prisma`, remplace `provider = "sqlite"` par `"mysql"`, mets
`DATABASE_URL="mysql://root:@localhost:3306/outilflow"` dans `.env`, puis relance `npm run setup`.
