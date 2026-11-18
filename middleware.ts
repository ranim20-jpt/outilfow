import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";
import { authSecret } from "@/lib/secret";

// Première barrière d'accès : la session doit exister et le rôle doit correspondre.
// Chaque page et chaque action revérifient ensuite côté serveur (requireUser).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, authSecret());
      role = String(payload.role);
    } catch {
      role = null;
    }
  }
  if (!role) {
    const next = `${pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(new URL(`/connexion?next=${encodeURIComponent(next)}`, req.url));
  }
  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (pathname.startsWith("/livreur") && role !== "LIVREUR") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/livreur/:path*", "/panier/:path*", "/commandes/:path*", "/profil/:path*"],
};
