import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dt, fmtDate } from "@/lib/format";
import AdminNav from "../components/AdminNav";
import Flash from "../components/Flash";
import { marquerNotificationsLues, publierAnnonce, supprimerNotification } from "../actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const horsAnnulee = { statut: { not: "ANNULEE" } };

  const [ca, nbProduits, nbClients, stock, enAttente, enCours, nbAlertes, produits, annonces] =
    await Promise.all([
      prisma.commande.aggregate({ _sum: { total: true }, where: horsAnnulee }),
      prisma.produit.count({ where: { actif: true } }),
      prisma.user.count({ where: { role: { in: ["PARTICULIER", "PROFESSIONNEL"] } } }),
      prisma.produit.aggregate({ _sum: { quantiteStock: true }, where: { actif: true } }),
      prisma.commande.count({ where: { statut: "EN_ATTENTE" } }),
      prisma.livraison.count({ where: { statut: "EN_COURS" } }),
      prisma.notification.count({ where: { lue: false, cible: "ADMIN" } }),
      prisma.produit.findMany({
        where: { actif: true, prixDetail: { not: null } },
        select: { id: true, nom: true, quantiteStock: true, seuilAlerte: true },
        orderBy: { quantiteStock: "asc" },
      }),
      prisma.notification.findMany({ where: { cible: "CLIENT" }, orderBy: { date: "desc" }, take: 8 }),
    ]);

  const faibles = produits.filter((p) => p.quantiteStock <= p.seuilAlerte);
  const ruptures = faibles.filter((p) => p.quantiteStock <= 0).length;
  const presque = faibles.length - ruptures;

  return (
    <>
      <h1>Tableau de bord</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />

      {faibles.length > 0 ? (
        <div className="alert-banner warn" role="alert">
          <span className="alert-icon" aria-hidden="true">!</span>
          <div>
            <strong>Stock à surveiller :</strong>{" "}
            {ruptures > 0 && `${ruptures} en rupture`}
            {ruptures > 0 && presque > 0 && " · "}
            {presque > 0 && `${presque} presque terminé${presque > 1 ? "s" : ""}`}
            {" — "}
            <Link href="#stock">voir la liste</Link>
          </div>
        </div>
      ) : (
        <div className="alert-banner info" role="status">
          <span className="alert-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Tout est en ordre.</strong> Aucun produit en rupture ou en stock faible.
          </div>
        </div>
      )}

      <section style={{ marginTop: "1.2rem" }}>
        <h2 style={{ marginBottom: ".6rem" }}>Vue d’ensemble</h2>
        <div className="grid stats">
          <div className="card stat">
            <div className="muted small">Chiffre d’affaires</div>
            <div className="value">{dt(ca._sum.total ?? 0)}</div>
          </div>
          <div className="card stat">
            <div className="muted small">Commandes en attente</div>
            <div className="value">{enAttente}</div>
          </div>
          <div className="card stat">
            <div className="muted small">Livraisons en cours</div>
            <div className="value">{enCours}</div>
          </div>
          <div className="card stat">
            <div className="muted small">Produits en alerte</div>
            <div className="value">{faibles.length}</div>
          </div>
          <div className="card stat">
            <div className="muted small">Clients</div>
            <div className="value">{nbClients}</div>
          </div>
          <div className="card stat">
            <div className="muted small">Produits actifs</div>
            <div className="value">{nbProduits}</div>
            <div className="muted small">{stock._sum.quantiteStock ?? 0} unités en stock</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "1.8rem" }}>
        <h2 style={{ marginBottom: ".6rem" }}>Accès rapide</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          <Link href="/admin/produits" className="card link">
            <strong>Produits</strong>
            <span className="muted small">Catalogue, prix, stock et catégories</span>
          </Link>
          <Link href="/admin/commandes" className="card link">
            <strong>Commandes & livraisons</strong>
            <span className="muted small">Suivi, statuts et affectation livreur</span>
          </Link>
          <Link href="/admin/utilisateurs" className="card link">
            <strong>Utilisateurs</strong>
            <span className="muted small">Clients, livreurs et comptes admin</span>
          </Link>
        </div>
      </section>

      <section id="stock" style={{ marginTop: "1.8rem" }}>
        <div className="section-head" style={{ marginTop: 0 }}>
          <div>
            <h2 style={{ margin: 0 }}>Stock à surveiller</h2>
            <p className="muted small" style={{ margin: ".2rem 0 0" }}>
              Produits en rupture ou presque terminés (seuil d’alerte atteint)
            </p>
          </div>
          {nbAlertes > 0 && (
            <form action={marquerNotificationsLues}>
              <button className="btn secondary small" type="submit">
                Marquer les alertes comme lues ({nbAlertes})
              </button>
            </form>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>État</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faibles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Aucun produit en alerte pour le moment.
                  </td>
                </tr>
              ) : (
                faibles.slice(0, 15).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nom}</strong>
                    </td>
                    <td>
                      {p.quantiteStock <= 0 ? (
                        <span className="badge bad">Rupture</span>
                      ) : (
                        <span className="badge warn">Presque terminé · {p.quantiteStock} restant(s)</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/admin/produits/${p.id}`} className="btn secondary small">
                        Gérer
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {faibles.length > 15 && (
          <p className="muted small" style={{ marginTop: ".5rem" }}>
            + {faibles.length - 15} autre(s) produit(s) en alerte. <Link href="/admin/produits">Voir tous les produits</Link>.
          </p>
        )}
      </section>

      <section style={{ marginTop: "1.8rem" }}>
        <h2 style={{ marginBottom: ".3rem" }}>Annonces aux clients</h2>
        <p className="muted small" style={{ marginTop: 0 }}>
          Publiez une promo ou une information visible par les clients dans leurs notifications.
        </p>
        <div className="two" style={{ alignItems: "start" }}>
          <div className="card stack">
            <h3 style={{ margin: 0 }}>Nouvelle annonce</h3>
            <form action={publierAnnonce} className="stack wide" style={{ maxWidth: "none" }}>
              <div className="row">
                <label className="shrink" style={{ minWidth: 160 }}>
                  Type
                  <select name="type" defaultValue="PROMO">
                    <option value="PROMO">Promo</option>
                    <option value="ANNONCE">Annonce</option>
                  </select>
                </label>
                <label>
                  Titre (optionnel)
                  <input name="titre" placeholder="Ex. Promo du mois" />
                </label>
              </div>
              <label>
                Message
                <textarea name="message" rows={3} required placeholder="Décrivez la promotion ou l’annonce…" />
              </label>
              <button className="btn" type="submit">
                Publier
              </button>
            </form>
          </div>

          <div className="card stack">
            <h3 style={{ margin: 0 }}>Annonces publiées</h3>
            {annonces.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                Aucune annonce pour le moment.
              </p>
            ) : (
              <div className="stack" style={{ gap: ".6rem" }}>
                {annonces.map((a) => (
                  <div key={a.id} className="notif-item">
                    <div>
                      <span className={`badge ${a.type === "PROMO" ? "gros" : ""}`}>
                        {a.type === "PROMO" ? "Promo" : "Annonce"}
                      </span>{" "}
                      {a.titre && <strong>{a.titre}</strong>}
                      <div style={{ marginTop: ".2rem" }}>{a.message}</div>
                      <div className="muted small">{fmtDate(a.date)}</div>
                    </div>
                    <form action={supprimerNotification}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn secondary small" type="submit">
                        Supprimer
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
