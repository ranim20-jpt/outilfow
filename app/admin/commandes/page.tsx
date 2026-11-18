import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PAGE_SIZE, ROLE_LABELS, STATUTS_COMMANDE, STATUTS_LIVRAISON, type Role } from "@/lib/constants";
import { dt, fmtDate } from "@/lib/format";
import AdminNav from "../../components/AdminNav";
import Flash from "../../components/Flash";
import { affecterLivreur, changerStatutCommande, changerStatutLivraisonAdmin } from "../../actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminCommandesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const page = Math.max(1, Number(sp.page) || 1);
  const total = await prisma.commande.count();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const [commandes, livreurs] = await Promise.all([
    prisma.commande.findMany({
      orderBy: { dateCommande: "desc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        user: true,
        lignes: { include: { produit: true } },
        livraison: { include: { livreur: true } },
      },
    }),
    prisma.user.findMany({ where: { role: "LIVREUR", actif: true }, orderBy: { nom: "asc" } }),
  ]);
  const lien = (p: number) => `/admin/commandes?page=${p}`;

  return (
    <>
      <h1>Commandes et livraisons</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />
      {commandes.length === 0 && <p className="card">Aucune commande pour le moment.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Commande</th>
              <th>Client</th>
              <th>Contenu</th>
              <th>Statut</th>
              <th>Livraison</th>
            </tr>
          </thead>
          <tbody>
            {commandes.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>#{c.id}</strong>
                  <div className="muted small">{fmtDate(c.dateCommande)}</div>
                  <div>{dt(c.total)}</div>
                  <span className={`badge ${c.typeVente === "GROS" ? "gros" : ""}`}>
                    {c.typeVente === "GROS" ? "Gros" : "Détail"}
                  </span>
                </td>
                <td>
                  {c.user.prenom} {c.user.nom}
                  <div className="muted small">{ROLE_LABELS[c.user.role as Role]}</div>
                  <div className="muted small">{c.user.telephone}</div>
                </td>
                <td className="small">
                  {c.lignes.map((l) => (
                    <div key={l.id}>
                      {l.quantite} × {l.produit.nom}
                    </div>
                  ))}
                </td>
                <td>
                  <form action={changerStatutCommande}>
                    <input type="hidden" name="commandeId" value={c.id} />
                    <select name="statut" defaultValue={c.statut}>
                      {STATUTS_COMMANDE.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    <button className="btn secondary small" type="submit">
                      OK
                    </button>
                  </form>
                </td>
                <td>
                  {c.livraison ? (
                    <>
                      <div className="small">{c.livraison.adresseLivraison}</div>
                      <div className="muted small">
                        {[c.livraison.ville, c.livraison.gouvernorat].filter(Boolean).join(", ") || "Zone non précisée"}
                      </div>
                      <div className="muted small">
                        Livreur :{" "}
                        {c.livraison.livreur ? (
                          `${c.livraison.livreur.prenom} ${c.livraison.livreur.nom}`
                        ) : (
                          <span className="badge warn">à affecter</span>
                        )}
                      </div>
                      <form action={affecterLivreur}>
                        <input type="hidden" name="commandeId" value={c.id} />
                        <select name="livreurId" defaultValue={c.livraison.livreurId ?? ""} required>
                          <option value="" disabled>
                            Livreur…
                          </option>
                          {livreurs.map((l) => (
                            <option key={l.id} value={l.id} disabled={!l.disponible}>
                              {l.prenom} {l.nom}
                              {!l.disponible ? " (indisponible)" : ""}
                            </option>
                          ))}
                        </select>
                        <button className="btn secondary small" type="submit">
                          Affecter
                        </button>
                      </form>
                      <form action={changerStatutLivraisonAdmin}>
                        <input type="hidden" name="livraisonId" value={c.livraison.id} />
                        <select name="statut" defaultValue={c.livraison.statut}>
                          {STATUTS_LIVRAISON.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <button className="btn secondary small" type="submit">
                          OK
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="muted small">Retrait en magasin</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        {safePage > 1 && (
          <Link className="btn secondary small" href={lien(safePage - 1)}>
            ← Précédent
          </Link>
        )}
        <span className="muted">
          Page {safePage} / {pages} · {total} commande(s)
        </span>
        {safePage < pages && (
          <Link className="btn secondary small" href={lien(safePage + 1)}>
            Suivant →
          </Link>
        )}
      </div>
      <p className="muted small">
        Les ventes sont consultables côté client dans <Link href="/commandes">Mes commandes</Link>.
      </p>
    </>
  );
}
