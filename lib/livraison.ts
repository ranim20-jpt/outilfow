import type { Prisma } from "@prisma/client";
import { GOUVERNORAT_NABEUL } from "@/lib/constants";

/** Retire les accents et la casse pour comparer des libellés saisis librement. */
export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Villes et délégations du gouvernorat de Nabeul (utilisées si le gouvernorat
// n'est pas renseigné, par exemple pour les anciennes livraisons).
const VILLES_NABEUL = [
  "nabeul",
  "dar chaabane",
  "beni khiar",
  "korba",
  "menzel temime",
  "el mida",
  "kelibia",
  "el haouaria",
  "takelsa",
  "soliman",
  "menzel bouzelfa",
  "beni khalled",
  "grombalia",
  "bou argoub",
  "hammamet",
  "mrezga",
  "tazarka",
  "maamoura",
];

/** Indique si une livraison se trouve dans le gouvernorat de Nabeul. */
export function estLivraisonNabeul(l: {
  gouvernorat: string | null;
  ville: string | null;
  adresseLivraison: string;
}): boolean {
  if (l.gouvernorat) return normaliser(l.gouvernorat) === normaliser(GOUVERNORAT_NABEUL);
  const texte = normaliser(`${l.ville ?? ""} ${l.adresseLivraison}`);
  return VILLES_NABEUL.some((v) => texte.includes(v));
}

/** Change le statut d'une livraison et conserve l'historique. */
export async function changerStatutLivraison(
  tx: Prisma.TransactionClient,
  livraisonId: number,
  statut: string,
) {
  const l = await tx.livraison.findUnique({
    where: { id: livraisonId },
    include: { commande: true },
  });
  if (!l) throw new Error("Livraison introuvable.");
  if (l.commande.statut === "ANNULEE") {
    throw new Error("Impossible de modifier la livraison d’une commande annulée.");
  }
  await tx.livraison.update({ where: { id: livraisonId }, data: { statut } });
  await tx.historiqueLivraison.create({ data: { livraisonId, statut } });
  if (statut === "LIVREE") {
    await tx.commande.update({ where: { id: l.commandeId }, data: { statut: "TERMINEE" } });
  } else if (statut === "EN_PREPARATION") {
    await tx.commande.updateMany({
      where: { id: l.commandeId, statut: "EN_ATTENTE" },
      data: { statut: "EN_PREPARATION" },
    });
  }
}
