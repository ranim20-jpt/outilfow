import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { imageProduit } from "../lib/images";

const prisma = new PrismaClient();
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type Article = {
  id: number;
  categorieId: number;
  codeStq: string;
  libelle: string;
  prixHtva: number | null;
  codeEnDouble: boolean;
  prixNonSpecifie: boolean;
};

async function main() {
  const data = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "prisma", "catalogue.json"), "utf8"),
  ) as { categories: { id: number; nom: string }[]; articles: Article[] };

  // Le seed réinitialise toute la base (usage développement uniquement)
  await prisma.notification.deleteMany();
  await prisma.historiqueLivraison.deleteMany();
  await prisma.livraison.deleteMany();
  await prisma.ligneCommande.deleteMany();
  await prisma.commande.deleteMany();
  await prisma.lignePanier.deleteMany();
  await prisma.panier.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.categorie.deleteMany();
  await prisma.user.deleteMany();

  await prisma.categorie.createMany({ data: data.categories });

  // Valeurs de démonstration : le dump SQL ne contient ni prix de gros, ni stock.
  const produits = data.articles.map((a) => {
    const prix = a.prixHtva;
    const quantiteMinGros = prix === null ? 10 : prix < 5 ? 50 : prix < 20 ? 20 : 10;
    const quantiteStock = a.prixNonSpecifie
      ? 0
      : a.id % 53 === 0
        ? 0
        : a.id % 25 === 0
          ? 3
          : 20 + ((a.id * 7) % 80);
    return {
      id: a.id,
      categorieId: a.categorieId,
      codeStq: a.codeStq,
      nom: a.libelle,
      description: `Code article : ${a.codeStq}`,
      image: imageProduit(a.id, a.categorieId),
      prixDetail: prix,
      prixGros: prix === null ? null : round3(prix * 0.85),
      quantiteMinGros,
      quantiteStock,
      seuilAlerte: 5,
      unite: /PAQUET/.test(a.libelle) ? "paquet" : /^GANT/.test(a.libelle) ? "paire" : "pièce",
    };
  });
  await prisma.produit.createMany({ data: produits });

  for (const p of produits) {
    if (p.prixDetail === null) continue;
    if (p.quantiteStock <= 0) {
      await prisma.notification.create({
        data: { type: "RUPTURE", produitId: p.id, message: `Rupture de stock : ${p.nom}` },
      });
    } else if (p.quantiteStock <= p.seuilAlerte) {
      await prisma.notification.create({
        data: {
          type: "STOCK_FAIBLE",
          produitId: p.id,
          message: `Stock faible : ${p.nom} (${p.quantiteStock} restant)`,
        },
      });
    }
  }

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  await prisma.user.createMany({
    data: [
      { nom: "Bochtiba", prenom: "Gérant", email: "admin@outilflow.tn", motDePasse: hash("Admin123!"), role: "ADMIN", telephone: "70 000 000" },
      { nom: "Trabelsi", prenom: "Karim", email: "livreur1@outilflow.tn", motDePasse: hash("Livreur123!"), role: "LIVREUR", telephone: "22 111 111" },
      { nom: "Gharbi", prenom: "Sami", email: "livreur2@outilflow.tn", motDePasse: hash("Livreur123!"), role: "LIVREUR", telephone: "22 222 222" },
      { nom: "Ben Ali", prenom: "Amira", email: "client@outilflow.tn", motDePasse: hash("Client123!"), role: "PARTICULIER", telephone: "50 333 333", adresse: "12 rue de la Liberté, Tunis" },
      { nom: "Mansour", prenom: "Walid", email: "pro@outilflow.tn", motDePasse: hash("Pro12345!"), role: "PROFESSIONNEL", telephone: "55 444 444", adresse: "Zone industrielle, Ben Arous", raisonSociale: "Plomberie Mansour", matriculeFiscale: "1234567/A/M/000" },
    ],
  });

  console.log(`Seed terminé : ${data.categories.length} catégories, ${produits.length} produits, 5 comptes de démonstration.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
