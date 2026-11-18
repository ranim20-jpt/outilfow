import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CLIENT_ROLES } from "@/lib/constants";
import { dt } from "@/lib/format";
import Flash from "../../components/Flash";
import StockBadge from "../../components/StockBadge";
import { ajouterAuPanier } from "../../actions/panier";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ProduitPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const produit = await prisma.produit.findUnique({
    where: { id: Number(id) || 0 },
    include: { categorie: true },
  });
  if (!produit || !produit.actif) notFound();

  const session = await getSession();
  const isClient = !!session && CLIENT_ROLES.includes(session.role);
  const isPro = session?.role === "PROFESSIONNEL";
  const commandable = produit.prixDetail !== null && produit.quantiteStock > 0;

  return (
    <>
      <p>
        <Link href={`/produits?categorie=${produit.categorieId}`}>← {produit.categorie.nom}</Link>
      </p>
      <Flash error={sp.error} ok={sp.ok} />
      <div className="stack wide" style={{ maxWidth: 820, gap: "1rem" }}>
        <div className="card" style={{ display: "grid", gap: ".75rem" }}>
          <div className="product-mark lg" aria-hidden="true">
            <span>{produit.nom.charAt(0)}</span>
          </div>
          <div>
            <span className="chip">{produit.categorie.nom}</span>
            <h1 style={{ marginTop: ".5rem", marginBottom: ".35rem" }}>{produit.nom}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {produit.description || "Article de quincaillerie."} · Unité de vente : {produit.unite}
            </p>
          </div>
        </div>

        <div className="card" style={{ display: "grid", gap: ".6rem" }}>
          <div className="product-meta">
            <StockBadge
              quantiteStock={produit.quantiteStock}
              seuilAlerte={produit.seuilAlerte}
              prixDetail={produit.prixDetail}
            />
            {produit.quantiteStock > 0 && (
              <span className="muted small">{produit.quantiteStock} disponible(s)</span>
            )}
            <span className="muted small">Code : {produit.codeStq}</span>
          </div>
          <p className="price" style={{ margin: 0 }}>
            {dt(produit.prixDetail)} <span className="small muted" style={{ fontWeight: 500 }}>/ {produit.unite}</span>
          </p>
          {produit.prixGros !== null &&
            (isPro ? (
              <p style={{ margin: 0 }}>
                <span className="badge gros">Prix professionnel</span> {dt(produit.prixGros)} par {produit.unite} à partir
                de {produit.quantiteMinGros} {produit.unite}
                {produit.quantiteMinGros > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>
                Un tarif de gros est réservé aux comptes professionnels.
              </p>
            ))}
        </div>

        {isClient && commandable && (
          <form action={ajouterAuPanier} className="stack card wide" style={{ maxWidth: "none" }}>
            <input type="hidden" name="produitId" value={produit.id} />
            <div className="row">
              <label style={{ maxWidth: 180 }}>
                Quantité
                <input type="number" name="quantite" min={1} max={produit.quantiteStock} defaultValue={1} required />
              </label>
              <button className="btn shrink" type="submit">
                Ajouter au panier
              </button>
            </div>
            {isPro && (
              <span className="muted small">Le prix de gros est appliqué automatiquement dans le panier.</span>
            )}
          </form>
        )}

        {!session && (
          <p className="card" style={{ margin: 0 }}>
            <Link href={`/connexion?next=/produits/${produit.id}`}>Connectez-vous</Link> pour commander.
          </p>
        )}
        {isClient && !commandable && (
          <p className="card" style={{ margin: 0 }}>
            Ce produit n’est pas commandable actuellement.
          </p>
        )}
      </div>
    </>
  );
}
