"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { changerStatutLivraison } from "@/lib/livraison";
import { back, fstr } from "@/lib/utils";

const AUTORISES = ["EN_PREPARATION", "EN_COURS", "LIVREE", "ECHEC"];

export async function majStatutLivraison(fd: FormData) {
  const livreur = await requireUser(["LIVREUR"]);
  const livraisonId = Number(fd.get("livraisonId"));
  const statut = fstr(fd, "statut");
  if (!AUTORISES.includes(statut)) back("/livreur", "Statut invalide.");

  // Un livreur ne peut modifier que les livraisons qui lui sont affectées
  const livraison = await prisma.livraison.findFirst({ where: { id: livraisonId, livreurId: livreur.id } });
  if (!livraison) back("/livreur", "Livraison introuvable.");
  if (livraison.statut === "LIVREE" || livraison.statut === "ECHEC") {
    back("/livreur", "Cette livraison est déjà terminée.");
  }

  try {
    await prisma.$transaction((tx) => changerStatutLivraison(tx, livraison.id, statut));
  } catch (e) {
    back("/livreur", e instanceof Error ? e.message : "Impossible de mettre à jour la livraison.");
  }
  back("/livreur", `Livraison #${livraison.id} mise à jour.`, "ok");
}
