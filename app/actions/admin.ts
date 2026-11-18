"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLES, STATUTS_COMMANDE, STATUTS_LIVRAISON } from "@/lib/constants";
import { changerStatutLivraison } from "@/lib/livraison";
import { notifierStock } from "@/lib/stock";
import { back, fnum, fstr } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function enregistrerProduit(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id")) || null;
  const page = id ? `/admin/produits/${id}` : "/admin/produits/nouveau";

  const nom = fstr(fd, "nom");
  const codeStq = fstr(fd, "codeStq");
  const categorieId = Number(fd.get("categorieId"));
  if (!nom || !codeStq || !categorieId) back(page, "Nom, code article et catégorie sont obligatoires.");

  const prixDetail = fnum(fd, "prixDetail");
  const prixGros = fnum(fd, "prixGros");
  if ((prixDetail !== null && prixDetail < 0) || (prixGros !== null && prixGros < 0)) {
    back(page, "Les prix ne peuvent pas être négatifs.");
  }
  if (prixDetail !== null && prixGros !== null && prixGros > prixDetail) {
    back(page, "Le prix de gros doit être inférieur ou égal au prix de détail.");
  }
  if (prixGros !== null && prixDetail === null) {
    back(page, "Renseignez le prix de détail avant de définir un prix de gros.");
  }

  const data = {
    nom,
    codeStq,
    categorieId,
    description: fstr(fd, "description") || null,
    image: fstr(fd, "image") || null,
    unite: fstr(fd, "unite") || "pièce",
    prixDetail,
    prixGros,
    quantiteMinGros: Math.max(1, Math.floor(fnum(fd, "quantiteMinGros") ?? 10)),
    quantiteStock: Math.max(0, Math.floor(fnum(fd, "quantiteStock") ?? 0)),
    seuilAlerte: Math.max(0, Math.floor(fnum(fd, "seuilAlerte") ?? 5)),
    actif: fd.get("actif") === "on",
  };

  const produit = id
    ? await prisma.produit.update({ where: { id }, data })
    : await prisma.produit.create({ data });
  if (data.actif && data.prixDetail !== null) await notifierStock(prisma, produit.id);
  back("/admin/produits", "Produit enregistré.", "ok");
}

export async function supprimerProduit(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  const utilise = await prisma.ligneCommande.count({ where: { produitId: id } });
  if (utilise > 0) {
    await prisma.produit.update({ where: { id }, data: { actif: false } });
    back("/admin/produits", "Produit déjà commandé : il a été désactivé (archivé) au lieu d’être supprimé.", "ok");
  }
  await prisma.produit.delete({ where: { id } });
  back("/admin/produits", "Produit supprimé.", "ok");
}

export async function creerCategorie(fd: FormData) {
  await requireUser(["ADMIN"]);
  const nom = fstr(fd, "nom");
  if (!nom) back("/admin/produits", "Le nom de la catégorie est obligatoire.");
  if (await prisma.categorie.findUnique({ where: { nom } })) back("/admin/produits", "Cette catégorie existe déjà.");
  await prisma.categorie.create({ data: { nom } });
  back("/admin/produits", "Catégorie créée.", "ok");
}

export async function renommerCategorie(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  const nom = fstr(fd, "nom");
  if (!nom) back("/admin/produits", "Le nom de la catégorie est obligatoire.");

  const categorie = await prisma.categorie.findUnique({ where: { id } });
  if (!categorie) back("/admin/produits", "Catégorie introuvable.");
  const existante = await prisma.categorie.findUnique({ where: { nom } });
  if (existante && existante.id !== id) back("/admin/produits", "Une autre catégorie porte déjà ce nom.");

  await prisma.categorie.update({ where: { id }, data: { nom } });
  back("/admin/produits", "Catégorie renommée.", "ok");
}

export async function supprimerCategorie(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  const categorie = await prisma.categorie.findUnique({
    where: { id },
    include: { _count: { select: { produits: true } } },
  });
  if (!categorie) back("/admin/produits", "Catégorie introuvable.");
  if (categorie._count.produits > 0) {
    back(
      "/admin/produits",
      `Impossible de supprimer cette catégorie : ${categorie._count.produits} produit(s) l’utilisent encore.`,
    );
  }
  await prisma.categorie.delete({ where: { id } });
  back("/admin/produits", "Catégorie supprimée.", "ok");
}

export async function changerStatutCommande(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("commandeId"));
  const statut = fstr(fd, "statut");
  if (!STATUTS_COMMANDE.some((s) => s.value === statut)) back("/admin/commandes", "Statut invalide.");

  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.commande.findUnique({
        where: { id },
        include: { lignes: true, livraison: true },
      });
      if (!c) throw new Error("Commande introuvable.");
      if (c.statut === "ANNULEE" && statut !== "ANNULEE") {
        throw new Error("Une commande annulée ne peut pas être réactivée (le stock a été restitué).");
      }
      if (statut === "ANNULEE" && c.statut !== "ANNULEE") {
        if (c.statut === "TERMINEE" || c.livraison?.statut === "LIVREE") {
          throw new Error("Impossible d’annuler une commande déjà livrée ou terminée.");
        }
        // L'annulation restitue le stock
        for (const l of c.lignes) {
          await tx.produit.update({ where: { id: l.produitId }, data: { quantiteStock: { increment: l.quantite } } });
        }
      }
      await tx.commande.update({ where: { id }, data: { statut } });
    });
  } catch (e) {
    back("/admin/commandes", e instanceof Error ? e.message : "Erreur.");
  }
  back("/admin/commandes", `Commande #${id} mise à jour.`, "ok");
}

export async function affecterLivreur(fd: FormData) {
  await requireUser(["ADMIN"]);
  const commandeId = Number(fd.get("commandeId"));
  const livreurId = Number(fd.get("livreurId"));
  const livraison = await prisma.livraison.findUnique({ where: { commandeId } });
  if (!livraison) back("/admin/commandes", "Cette commande n’est pas à livrer.");
  const livreur = await prisma.user.findFirst({
    where: { id: livreurId, role: "LIVREUR", actif: true, disponible: true },
  });
  if (!livreur) back("/admin/commandes", "Choisissez un livreur actif et disponible.");
  await prisma.livraison.update({
    where: { id: livraison.id },
    data: { livreurId: livreur.id, dateAffectation: new Date() },
  });
  back("/admin/commandes", `Commande #${commandeId} affectée à ${livreur.prenom} ${livreur.nom}.`, "ok");
}

export async function changerStatutLivraisonAdmin(fd: FormData) {
  await requireUser(["ADMIN"]);
  const livraisonId = Number(fd.get("livraisonId"));
  const statut = fstr(fd, "statut");
  if (!STATUTS_LIVRAISON.some((s) => s.value === statut)) back("/admin/commandes", "Statut invalide.");
  try {
    await prisma.$transaction((tx) => changerStatutLivraison(tx, livraisonId, statut));
  } catch (e) {
    back("/admin/commandes", e instanceof Error ? e.message : "Erreur.");
  }
  back("/admin/commandes", "Statut de livraison mis à jour.", "ok");
}

export async function creerUtilisateur(fd: FormData) {
  await requireUser(["ADMIN"]);
  const role = fstr(fd, "role");
  const email = fstr(fd, "email").toLowerCase();
  const motDePasse = String(fd.get("motDePasse") ?? "");
  if (!ROLES.some((r) => r === role)) back("/admin/utilisateurs", "Rôle invalide.");
  if (!fstr(fd, "nom") || !fstr(fd, "prenom")) back("/admin/utilisateurs", "Nom et prénom sont obligatoires.");
  if (!EMAIL.test(email)) back("/admin/utilisateurs", "Adresse e-mail invalide.");
  if (motDePasse.length < 6) back("/admin/utilisateurs", "Mot de passe : 6 caractères minimum.");
  if (await prisma.user.findUnique({ where: { email } })) back("/admin/utilisateurs", "Cet e-mail est déjà utilisé.");
  await prisma.user.create({
    data: {
      nom: fstr(fd, "nom"),
      prenom: fstr(fd, "prenom"),
      email,
      role,
      telephone: fstr(fd, "telephone") || null,
      motDePasse: await bcrypt.hash(motDePasse, 10),
    },
  });
  back("/admin/utilisateurs", "Utilisateur créé.", "ok");
}

export async function basculerActif(fd: FormData) {
  const admin = await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  if (id === admin.id) back("/admin/utilisateurs", "Vous ne pouvez pas désactiver votre propre compte.");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) back("/admin/utilisateurs", "Utilisateur introuvable.");
  await prisma.user.update({ where: { id }, data: { actif: !u.actif } });
  back("/admin/utilisateurs", u.actif ? "Compte désactivé." : "Compte réactivé.", "ok");
}

export async function basculerDisponible(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u || u.role !== "LIVREUR") back("/admin/utilisateurs", "Livreur introuvable.");
  await prisma.user.update({ where: { id }, data: { disponible: !u.disponible } });
  back(
    "/admin/utilisateurs",
    u.disponible ? "Livreur marqué comme indisponible." : "Livreur marqué comme disponible.",
    "ok",
  );
}

export async function marquerNotificationsLues() {
  await requireUser(["ADMIN"]);
  await prisma.notification.updateMany({ where: { lue: false, cible: "ADMIN" }, data: { lue: true } });
  back("/admin", "Notifications marquées comme lues.", "ok");
}

export async function publierAnnonce(fd: FormData) {
  await requireUser(["ADMIN"]);
  const message = fstr(fd, "message");
  const titre = fstr(fd, "titre") || null;
  const type = fstr(fd, "type") === "PROMO" ? "PROMO" : "ANNONCE";
  if (!message) back("/admin", "Le message de l’annonce est obligatoire.");
  await prisma.notification.create({ data: { type, titre, message, cible: "CLIENT", lue: false } });
  back("/admin", "Annonce publiée pour les clients.", "ok");
}

export async function supprimerNotification(fd: FormData) {
  await requireUser(["ADMIN"]);
  const id = Number(fd.get("id"));
  await prisma.notification.delete({ where: { id } }).catch(() => null);
  back("/admin", "Notification supprimée.", "ok");
}
