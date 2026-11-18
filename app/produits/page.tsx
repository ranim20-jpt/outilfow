import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PAGE_SIZE } from "@/lib/constants";
import { dt } from "@/lib/format";
import StockBadge from "../components/StockBadge";

type SP = Promise<Record<string, string | undefined>>;

export default async function CataloguePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await getSession();
  const isPro = session?.role === "PROFESSIONNEL";

  const q = (sp.q ?? "").trim();
  const categorie = Number(sp.categorie) || undefined;
  const min = sp.min ? Number(sp.min) : NaN;
  const max = sp.max ? Number(sp.max) : NaN;
  const tri = sp.tri ?? "nom";
  const page = Math.max(1, Number(sp.page) || 1);
  const prixInvalide = !Number.isNaN(min) && !Number.isNaN(max) && min > max;

  const prixFilter: Prisma.FloatNullableFilter = {};
  if (!Number.isNaN(min)) prixFilter.gte = min;
  if (!Number.isNaN(max)) prixFilter.lte = max;

  const where: Prisma.ProduitWhereInput = {
    actif: true,
    ...(q ? { nom: { contains: q } } : {}),
    ...(categorie ? { categorieId: categorie } : {}),
    ...(Object.keys(prixFilter).length ? { prixDetail: prixFilter } : {}),
  };
  const orderBy: Prisma.ProduitOrderByWithRelationInput =
    tri === "prix_asc" ? { prixDetail: "asc" } : tri === "prix_desc" ? { prixDetail: "desc" } : { nom: "asc" };

  const total = await prisma.produit.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const [produits, categories] = await Promise.all([
    prisma.produit.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { categorie: true },
    }),
    prisma.categorie.findMany({ orderBy: { nom: "asc" } }),
  ]);

  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categorie) params.set("categorie", String(categorie));
    if (!Number.isNaN(min)) params.set("min", String(min));
    if (!Number.isNaN(max)) params.set("max", String(max));
    if (tri !== "nom") params.set("tri", tri);
    params.set("page", String(p));
    return `/produits?${params.toString()}`;
  };

  return (
    <>
      <div className="section-head">
        <div>
          <h1 style={{ marginBottom: ".2rem" }}>Catalogue</h1>
          <p className="muted" style={{ margin: 0 }}>
            {total} produit{total > 1 ? "s" : ""} disponible{total > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <form className="filters" method="get">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom du produit" />
        </label>
        <label>
          Catégorie
          <select name="categorie" defaultValue={categorie ? String(categorie) : ""}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Prix min (DT)
          <input name="min" type="number" step="0.001" min="0" defaultValue={Number.isNaN(min) ? "" : min} />
        </label>
        <label>
          Prix max (DT)
          <input name="max" type="number" step="0.001" min="0" defaultValue={Number.isNaN(max) ? "" : max} />
        </label>
        <label>
          Tri
          <select name="tri" defaultValue={tri}>
            <option value="nom">Nom (A → Z)</option>
            <option value="prix_asc">Prix croissant</option>
            <option value="prix_desc">Prix décroissant</option>
          </select>
        </label>
        <button className="btn shrink" type="submit">
          Filtrer
        </button>
      </form>

      {prixInvalide && <p className="flash error">Le prix minimum ne peut pas dépasser le prix maximum.</p>}

      <div className="grid products">
        {produits.map((p) => (
          <Link key={p.id} href={`/produits/${p.id}`} className="card link product-card">
            <div className="product-mark" aria-hidden="true">
              <span>{p.nom.charAt(0)}</span>
            </div>
            <span className="chip">{p.categorie.nom}</span>
            <strong>{p.nom}</strong>
            <div className="price-row">
              <span className="price">{dt(p.prixDetail)}</span>
              {isPro && p.prixGros !== null && <span className="badge gros">Pro {dt(p.prixGros)}</span>}
            </div>
            {isPro && p.prixGros !== null && (
              <span className="small muted">
                Prix pro dès {p.quantiteMinGros} {p.unite}
              </span>
            )}
            <div className="product-meta">
              <StockBadge quantiteStock={p.quantiteStock} seuilAlerte={p.seuilAlerte} prixDetail={p.prixDetail} />
            </div>
          </Link>
        ))}
      </div>

      {produits.length === 0 && <p className="card empty">Aucun produit ne correspond à votre recherche.</p>}

      {pages > 1 && (
        <div className="pager">
          {safePage > 1 && (
            <Link className="btn secondary small" href={href(safePage - 1)}>
              ← Précédent
            </Link>
          )}
          <span className="muted">
            Page {safePage} / {pages}
          </span>
          {safePage < pages && (
            <Link className="btn secondary small" href={href(safePage + 1)}>
              Suivant →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
