"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLIENT_ROLES, FRAIS_LIVRAISON, GOUVERNORATS } from "@/lib/constants";
import { geocoderAdresse } from "@/lib/geo";
import { calculerPrix, round3 } from "@/lib/pricing";
import { notifierStock } from "@/lib/stock";
import { back, fnum, fstr } from "@/lib/utils";

export async function ajouterAuPanier(fd: FormData) {
  const user = await requireUser(CLIENT_ROLES);
  const produitId = Number(fd.get("produitId"));
  const quantite = Math.floor(Number(fd.get("quantite")));
  if (!produitId || !(quantite > 0)) back("/produits", "Quantité invalide.");

  const page = `/produits/${produitId}`;
  const produit = await prisma.produit.findUnique({ where: { id: produitId } });
  if (!produit || !produit.actif) back("/produits", "Produit introuvable.");
  if (produit.prixDetail === null) back(page, "Prix sur demande : ce produit ne peut pas être commandé en ligne.");

  const panier = await prisma.panier.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  const key = { panierId_produitId: { panierId: panier.id, produitId } };
  const existante = await prisma.lignePanier.findUnique({ where: key });
  const nouvelle = (existante?.quantite ?? 0) + quantite;
  if (nouvelle > produit.quantiteStock) {
    back(page, `Stock insuffisant (disponible : ${produit.quantiteStock}).`);
  }
  await prisma.lignePanier.upsert({
    where: key,
    update: { quantite: nouvelle },
    create: { panierId: panier.id, produitId, quantite },
  });
  back("/panier", "Produit ajouté au panier.", "ok");
}

export async function modifierQuantite(fd: FormData) {
  const user = await requireUser(CLIENT_ROLES);
  const ligneId = Number(fd.get("ligneId"));
  const quantite = Math.floor(Number(fd.get("quantite")));
  if (!Number.isFinite(quantite)) back("/panier", "Quantité invalide.");
  const ligne = await prisma.lignePanier.findFirst({
    where: { id: ligneId, panier: { userId: user.id } },
    include: { produit: true },
  });
  if (!ligne) back("/panier", "Ligne introuvable.");
  if (!(quantite > 0)) {
    await prisma.lignePanier.delete({ where: { id: ligne.id } });
    back("/panier", "Produit retiré du panier.", "ok");
  }
  if (quantite > ligne.produit.quantiteStock) {
    back("/panier", `Stock insuffisant pour « ${ligne.produit.nom} » (disponible : ${ligne.produit.quantiteStock}).`);
  }
  await prisma.lignePanier.update({ where: { id: ligne.id }, data: { quantite } });
  back("/panier", "Quantité mise à jour.", "ok");
}

export async function retirerDuPanier(fd: FormData) {
  const user = await requireUser(CLIENT_ROLES);
  await prisma.lignePanier.deleteMany({
    where: { id: Number(fd.get("ligneId")), panier: { userId: user.id } },
  });
  back("/panier", "Produit retiré du panier.", "ok");
}

export async function validerCommande(fd: FormData) {
  const user = await requireUser(CLIENT_ROLES);
  const mode = fstr(fd, "mode");
  const adresse = fstr(fd, "adresse");
  const gouvernorat = fstr(fd, "gouvernorat");
  const ville = fstr(fd, "ville");
  if (mode !== "RETRAIT" && mode !== "LIVRAISON") back("/panier", "Choisissez le retrait ou la livraison.");
  if (mode === "LIVRAISON") {
    if (adresse.length < 5) back("/panier", "Saisissez une adresse de livraison complète.");
    if (!GOUVERNORATS.includes(gouvernorat as (typeof GOUVERNORATS)[number])) {
      back("/panier", "Choisissez le gouvernorat de livraison.");
    }
    if (ville.length < 2) back("/panier", "Saisissez la ville ou la localité de livraison.");
  }

  let latitude = fnum(fd, "latitude");
  let longitude = fnum(fd, "longitude");
  if (latitude !== null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude !== null && (longitude < -180 || longitude > 180)) longitude = null;
  if (latitude === null || longitude === null) {
    latitude = null;
    longitude = null;
  }

  // Si le client n'a pas placé son repère, on tente de géocoder l'adresse.
  if (mode === "LIVRAISON" && latitude === null && longitude === null) {
    const point = await geocoderAdresse(adresse, ville, gouvernorat);
    if (point) {
      latitude = point.latitude;
      longitude = point.longitude;
    }
  }

  let commandeId: number;
  try {
    commandeId = await prisma.$transaction(async (tx) => {
      const panier = await tx.panier.findUnique({
        where: { userId: user.id },
        include: { lignes: { include: { produit: true } } },
      });
      if (!panier || panier.lignes.length === 0) throw new Error("Votre panier est vide.");

      let typeVente = "DETAIL";
      let sousTotal = 0;
      const lignes = panier.lignes.map((l) => {
        const p = calculerPrix(l.produit, l.quantite, user.role);
        if (p.prixUnitaire === null || p.sousTotal === null || !l.produit.actif) {
          throw new Error(`« ${l.produit.nom} » n’est plus commandable.`);
        }
        if (p.tarif === "GROS") typeVente = "GROS";
        sousTotal += p.sousTotal;
        return {
          produitId: l.produitId,
          quantite: l.quantite,
          prixUnitaire: p.prixUnitaire,
          sousTotal: p.sousTotal,
        };
      });

      // Décrémentation du stock : la condition `gte` protège contre les ventes concurrentes.
      for (const l of lignes) {
        const r = await tx.produit.updateMany({
          where: { id: l.produitId, quantiteStock: { gte: l.quantite } },
          data: { quantiteStock: { decrement: l.quantite } },
        });
        if (r.count !== 1) {
          const nom = panier.lignes.find((x) => x.produitId === l.produitId)?.produit.nom ?? "un produit";
          throw new Error(`Stock insuffisant pour « ${nom} ».`);
        }
      }

      const frais = mode === "LIVRAISON" ? FRAIS_LIVRAISON : 0;
      const commande = await tx.commande.create({
        data: {
          userId: user.id,
          typeVente,
          modeRecuperation: mode,
          total: round3(sousTotal + frais),
          lignes: { create: lignes },
        },
      });
      if (mode === "LIVRAISON") {
        const livraison = await tx.livraison.create({
          data: {
            commandeId: commande.id,
            adresseLivraison: adresse,
            gouvernorat,
            ville,
            latitude,
            longitude,
            fraisLivraison: frais,
          },
        });
        await tx.historiqueLivraison.create({ data: { livraisonId: livraison.id, statut: "EN_ATTENTE" } });
      }
      for (const l of lignes) await notifierStock(tx, l.produitId);
      await tx.lignePanier.deleteMany({ where: { panierId: panier.id } });
      return commande.id;
    });
  } catch (e) {
    back("/panier", e instanceof Error ? e.message : "Impossible de valider la commande.");
  }
  redirect(`/commandes/${commandeId}?ok=${encodeURIComponent("Commande enregistrée. Merci !")}`);
}
