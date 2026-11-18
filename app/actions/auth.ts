"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { back, fstr } from "@/lib/utils";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inscription(fd: FormData) {
  const role = fstr(fd, "role");
  const nom = fstr(fd, "nom");
  const prenom = fstr(fd, "prenom");
  const email = fstr(fd, "email").toLowerCase();
  const motDePasse = String(fd.get("motDePasse") ?? "");
  const confirmation = String(fd.get("confirmation") ?? "");
  const raisonSociale = fstr(fd, "raisonSociale");
  const matriculeFiscale = fstr(fd, "matriculeFiscale");

  if (role !== "PARTICULIER" && role !== "PROFESSIONNEL") back("/inscription", "Type de compte invalide.");
  if (!nom || !prenom) back("/inscription", "Nom et prénom sont obligatoires.");
  if (!EMAIL.test(email)) back("/inscription", "Adresse e-mail invalide.");
  if (motDePasse.length < 6) back("/inscription", "Le mot de passe doit contenir au moins 6 caractères.");
  if (motDePasse !== confirmation) back("/inscription", "Les deux mots de passe ne correspondent pas.");
  if (role === "PROFESSIONNEL" && (!raisonSociale || !matriculeFiscale)) {
    back("/inscription", "Raison sociale et matricule fiscal sont obligatoires pour un compte professionnel.");
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    back("/inscription", "Un compte existe déjà avec cet e-mail.");
  }

  const user = await prisma.user.create({
    data: {
      nom,
      prenom,
      email,
      motDePasse: await bcrypt.hash(motDePasse, 10),
      role,
      telephone: fstr(fd, "telephone") || null,
      adresse: fstr(fd, "adresse") || null,
      raisonSociale: role === "PROFESSIONNEL" ? raisonSociale : null,
      matriculeFiscale: role === "PROFESSIONNEL" ? matriculeFiscale : null,
    },
  });
  await createSession(user);
  redirect("/produits");
}

export async function connexion(fd: FormData) {
  const email = fstr(fd, "email").toLowerCase();
  const motDePasse = String(fd.get("motDePasse") ?? "");
  const next = fstr(fd, "next");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(motDePasse, user.motDePasse))) {
    back("/connexion", "E-mail ou mot de passe incorrect.");
  }
  if (!user.actif) back("/connexion", "Ce compte est désactivé. Contactez la quincaillerie.");

  await createSession(user);
  if (user.role === "ADMIN") redirect("/admin");
  if (user.role === "LIVREUR") redirect("/livreur");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/produits");
}

export async function deconnexion() {
  await destroySession();
  redirect("/");
}

export async function modifierProfil(fd: FormData) {
  const user = await requireUser();
  const nom = fstr(fd, "nom");
  const prenom = fstr(fd, "prenom");
  if (!nom || !prenom) back("/profil", "Nom et prénom sont obligatoires.");

  const nouveauMdp = String(fd.get("nouveauMotDePasse") ?? "");
  if (nouveauMdp && nouveauMdp.length < 6) {
    back("/profil", "Le nouveau mot de passe doit contenir au moins 6 caractères.");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      nom,
      prenom,
      telephone: fstr(fd, "telephone") || null,
      adresse: fstr(fd, "adresse") || null,
      ...(user.role === "PROFESSIONNEL"
        ? {
            raisonSociale: fstr(fd, "raisonSociale") || user.raisonSociale,
            matriculeFiscale: fstr(fd, "matriculeFiscale") || user.matriculeFiscale,
          }
        : {}),
      ...(nouveauMdp ? { motDePasse: await bcrypt.hash(nouveauMdp, 10) } : {}),
    },
  });
  back("/profil", "Profil mis à jour.", "ok");
}
