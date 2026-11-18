import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function imageProduit(id: number, categorieId: number): string {
  return `https://picsum.photos/seed/outilflow-${categorieId}-${id}/800/600`;
}

async function main() {
  // 1) Mettre à jour les photos de tous les produits (remplace les URLs externes cassées)
  const produits = await prisma.produit.findMany({ select: { id: true, categorieId: true } });
  for (const p of produits) {
    await prisma.produit.update({
      where: { id: p.id },
      data: { image: imageProduit(p.id, p.categorieId) },
    });
  }
  console.log(`Photos mises à jour: ${produits.length} produits`);

  // 2) Ajouter d'autres utilisateurs (s'ils n'existent pas déjà)
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const nouveaux = [
    {
      prenom: "Leila",
      nom: "Hadded",
      email: "client2@outilflow.tn",
      telephone: "50 555 666",
      adresse: "8 avenue Habib Bourguiba, Nabeul",
      role: "PARTICULIER",
      motDePasse: hash("Client123!"),
      actif: true,
      disponible: true,
    },
    {
      prenom: "Nizar",
      nom: "Jlassi",
      email: "pro2@outilflow.tn",
      telephone: "55 777 888",
      adresse: "Route de Sousse, Sousse",
      role: "PROFESSIONNEL",
      raisonSociale: "Électricité Jlassi",
      matriculeFiscale: "7654321/B/M/000",
      motDePasse: hash("Pro12345!"),
      actif: true,
      disponible: true,
    },
    {
      prenom: "Hatem",
      nom: "Bouaziz",
      email: "livreur3@outilflow.tn",
      telephone: "22 333 444",
      role: "LIVREUR",
      motDePasse: hash("Livreur123!"),
      actif: true,
      disponible: true,
    },
  ] as const;

  let created = 0;
  for (const u of nouveaux) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      await prisma.user.create({ data: u as any });
      created++;
      console.log(`Utilisateur créé: ${u.email} (${u.role})`);
    } else {
      console.log(`Déjà présent: ${u.email}`);
    }
  }
  console.log(`Utilisateurs ajoutés: ${created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
