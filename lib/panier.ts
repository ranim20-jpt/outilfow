import { prisma } from "./db";
import { calculerPrix, round3 } from "./pricing";

/** Charge le panier d'un client avec les prix recalculés selon son rôle et les quantités. */
export async function chargerPanier(userId: number, role: string) {
  const panier = await prisma.panier.findUnique({
    where: { userId },
    include: { lignes: { include: { produit: true }, orderBy: { id: "asc" } } },
  });
  const lignes = (panier?.lignes ?? []).map((l) => ({
    ...l,
    ...calculerPrix(l.produit, l.quantite, role),
  }));
  const sousTotal = round3(lignes.reduce((s, l) => s + (l.sousTotal ?? 0), 0));
  return { lignes, sousTotal };
}
