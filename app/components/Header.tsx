import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CLIENT_ROLES, type Role } from "@/lib/constants";
import { deconnexion } from "../actions/auth";

function Icon({ d, paths }: { d?: string; paths?: string[] }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d ? <path d={d} /> : paths?.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const icons = {
  catalogue: { paths: ["M4 5h6v6H4z", "M14 5h6v6h-6z", "M4 15h6v4H4z", "M14 15h6v4h-6z"] },
  panier: { paths: ["M6 6h15l-1.5 8.5H7.5L6 6z", "M6 6 5 3H2", "M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"] },
  commandes: { paths: ["M7 4h7l4 4v12H7z", "M14 4v4h4", "M10 12h5", "M10 16h5"] },
  admin: { paths: ["M4 13h4v7H4z", "M10 9h4v11h-4z", "M16 4h4v16h-4z"] },
  livraison: { paths: ["M2 7h11v8H2z", "M13 10h4l3 3v2h-7z", "M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z", "M17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"] },
  profil: { paths: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 16 0"] },
  connexion: { paths: ["M15 3h4v18h-4", "M10 17l5-5-5-5", "M15 12H3"] },
  inscription: { paths: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 20a8 8 0 0 1 11-7.3", "M19 14v6", "M16 17h6"] },
  deconnexion: { paths: ["M9 3H5v18h4", "M16 17l5-5-5-5", "M21 12H9"] },
  notif: { paths: ["M15 17H5l1.5-2V11a5.5 5.5 0 1 1 11 0v4L19 17h-4z", "M10 17a2 2 0 0 0 4 0"] },
  accueil: { paths: ["M4 10.5 12 4l8 6.5V20H4z", "M10 20v-5h4v5"] },
};

export default async function Header() {
  const s = await getSession();
  const user = s
    ? await prisma.user.findUnique({
        where: { id: s.id },
        select: { id: true, nom: true, prenom: true, role: true, actif: true },
      })
    : null;
  const nom = user ? `${user.prenom} ${user.nom}` : s?.nom;
  const role = user?.role ?? s?.role;
  const isClient = !!user?.actif && !!role && CLIENT_ROLES.includes(role as Role);
  const isAdmin = !!user?.actif && role === "ADMIN";
  const isLivreur = !!user?.actif && role === "LIVREUR";

  const [cartAgg, adminAlertCount, clientNotifCount] = await Promise.all([
    isClient
      ? prisma.lignePanier.aggregate({ where: { panier: { userId: user!.id } }, _sum: { quantite: true } })
      : Promise.resolve(null),
    isAdmin
      ? prisma.notification.count({ where: { lue: false, cible: "ADMIN" } })
      : Promise.resolve(0),
    isClient
      ? prisma.notification.count({ where: { cible: "CLIENT" } })
      : Promise.resolve(0),
  ]);
  const cartCount = cartAgg?._sum.quantite ?? 0;

  return (
    <header className="header">
      <div className="inner">
        <Link href="/" className="logo" title="Accueil" aria-label="Accueil">
          <span className="logo-mark" aria-hidden="true">OF</span>
          <span className="logo-text">Outil<span>Flow</span></span>
        </Link>
        <nav className="nav icon-nav nav-main" aria-label="Navigation principale">
          <div className="nav-pill">
            <Link href="/produits" className="icon-link" title="Catalogue" aria-label="Catalogue">
              <Icon {...icons.catalogue} />
              <span className="sr-only">Catalogue</span>
            </Link>
            {isClient && (
              <>
                <Link href="/panier" className="icon-link" title="Panier" aria-label="Panier">
                  <span className="icon-wrap">
                    <Icon {...icons.panier} />
                    {cartCount > 0 && <span className="icon-badge">{cartCount}</span>}
                  </span>
                  <span className="sr-only">Panier</span>
                </Link>
                <Link href="/commandes" className="icon-link" title="Mes commandes" aria-label="Mes commandes">
                  <Icon {...icons.commandes} />
                  <span className="sr-only">Mes commandes</span>
                </Link>
                <Link href="/notifications" className="icon-link" title="Notifications" aria-label="Notifications">
                  <span className="icon-wrap">
                    <Icon {...icons.notif} />
                    {clientNotifCount > 0 && <span className="icon-badge">{clientNotifCount}</span>}
                  </span>
                  <span className="sr-only">Notifications</span>
                </Link>
              </>
            )}
            {isAdmin && (
              <>
                <Link href="/admin" className="icon-link" title="Administration" aria-label="Administration">
                  <Icon {...icons.admin} />
                  <span className="sr-only">Administration</span>
                </Link>
                <Link href="/admin" className="icon-link" title="Alertes stock" aria-label="Alertes stock">
                  <span className="icon-wrap">
                    <Icon {...icons.notif} />
                    {adminAlertCount > 0 && <span className="icon-badge danger">{adminAlertCount}</span>}
                  </span>
                  <span className="sr-only">Alertes stock</span>
                </Link>
              </>
            )}
            {isLivreur && (
              <Link href="/livreur" className="icon-link" title="Mes livraisons" aria-label="Mes livraisons">
                <Icon {...icons.livraison} />
                <span className="sr-only">Mes livraisons</span>
              </Link>
            )}
          </div>
        </nav>
        <div className="nav icon-nav nav-account" aria-label="Compte">
          {s ? (
            <>
              <Link href="/profil" className="icon-link" title={nom ?? "Profil"} aria-label="Profil">
                <Icon {...icons.profil} />
                <span className="sr-only">Profil</span>
              </Link>
              <form action={deconnexion}>
                <button className="icon-link" type="submit" title="Déconnexion" aria-label="Déconnexion">
                  <Icon {...icons.deconnexion} />
                  <span className="sr-only">Déconnexion</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/connexion" className="icon-link" title="Connexion" aria-label="Connexion">
                <Icon {...icons.connexion} />
                <span className="sr-only">Connexion</span>
              </Link>
              <Link href="/inscription" className="icon-link accent" title="Inscription" aria-label="Inscription">
                <Icon {...icons.inscription} />
                <span className="sr-only">Inscription</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
