import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { dt } from "@/lib/format";
import AdminNav from "../../components/AdminNav";
import Flash from "../../components/Flash";
import ConfirmButton from "../../components/ConfirmButton";
import { creerCategorie, renommerCategorie, supprimerCategorie } from "../../actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminProduitsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.ProduitWhereInput = q ? { OR: [{ nom: { contains: q } }, { codeStq: { contains: q } }] } : {};

  const total = await prisma.produit.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const [produits, categories] = await Promise.all([
    prisma.produit.findMany({
      where,
      orderBy: { nom: "asc" },
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { categorie: true },
    }),
    prisma.categorie.findMany({
      orderBy: { nom: "asc" },
      include: { _count: { select: { produits: true } } },
    }),
  ]);
  const lien = (p: number) => `/admin/produits?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <h1>Produits</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />
      <div className="filters">
        <form method="get" className="row" style={{ flex: 2 }}>
          <label>
            Recherche (nom ou code)
            <input name="q" defaultValue={q} />
          </label>
          <button className="btn secondary shrink" type="submit">
            Chercher
          </button>
        </form>
        <Link href="/admin/produits/nouveau" className="btn">
          + Nouveau produit
        </Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Catégorie</th>
              <th>Détail</th>
              <th>Gros (dès)</th>
              <th>Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {produits.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="cell-product">
                    <div>
                      <span className="title">{p.nom}</span>
                      <div className="muted small">{p.codeStq}</div>
                      {!p.actif && <span className="badge">Archivé</span>}
                    </div>
                  </div>
                </td>
                <td>{p.categorie.nom}</td>
                <td>{dt(p.prixDetail)}</td>
                <td>
                  {p.prixGros === null ? "—" : `${dt(p.prixGros)} (${p.quantiteMinGros})`}
                </td>
                <td>
                  {p.quantiteStock}{" "}
                  {p.quantiteStock <= 0 ? (
                    <span className="badge bad">Rupture</span>
                  ) : p.quantiteStock <= p.seuilAlerte ? (
                    <span className="badge warn">Faible</span>
                  ) : null}
                </td>
                <td>
                  <Link href={`/admin/produits/${p.id}`}>Modifier</Link>
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
          Page {safePage} / {pages} · {total} produit(s)
        </span>
        {safePage < pages && (
          <Link className="btn secondary small" href={lien(safePage + 1)}>
            Suivant →
          </Link>
        )}
      </div>

      <h2>Catégories</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Produits</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <form action={renommerCategorie} className="row">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="nom" defaultValue={c.nom} required aria-label="Nom de la catégorie" />
                    <button className="btn secondary small shrink" type="submit">
                      Renommer
                    </button>
                  </form>
                </td>
                <td>{c._count.produits}</td>
                <td>
                  {c._count.produits > 0 ? (
                    <span className="muted small">Utilisée</span>
                  ) : (
                    <form action={supprimerCategorie}>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton
                        className="btn danger small"
                        confirm={`Supprimer définitivement la catégorie « ${c.nom} » ?`}
                      >
                        Supprimer
                      </ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Nouvelle catégorie</h2>
      <form action={creerCategorie} className="row card" style={{ maxWidth: 520 }}>
        <label>
          Nom
          <input name="nom" required />
        </label>
        <button className="btn shrink" type="submit">
          Ajouter
        </button>
      </form>
    </>
  );
}
