import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { authSecret } from "./secret";
import type { Role } from "./constants";

export type Session = { id: number; role: Role; nom: string };

const COOKIE = "session";

export async function createSession(user: { id: number; role: string; nom: string; prenom: string }) {
  const token = await new SignJWT({ role: user.role, nom: `${user.prenom} ${user.nom}` })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    return { id: Number(payload.sub), role: payload.role as Role, nom: String(payload.nom ?? "") };
  } catch {
    return null;
  }
}

/** Exige un utilisateur connecté (et actif) ; vérifie le rôle si `roles` est fourni. */
export async function requireUser(roles?: Role[]) {
  const s = await getSession();
  if (!s) redirect("/connexion");
  const user = await prisma.user.findUnique({ where: { id: s.id } });
  if (!user || !user.actif) {
    redirect("/connexion?error=" + encodeURIComponent("Compte introuvable ou désactivé."));
  }
  if (roles && !roles.includes(user.role as Role)) redirect("/");
  return user;
}
