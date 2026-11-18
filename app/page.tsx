import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function Accueil() {
  const [cats, produits] = await Promise.all([
    prisma.categorie.findMany({
      orderBy: { nom: "asc" },
      include: { _count: { select: { produits: { where: { actif: true } } } } },
    }),
    prisma.produit.findMany({
      where: { actif: true, prixDetail: { not: null } },
      orderBy: { id: "asc" },
      take: 8,
      include: { categorie: true },
    }),
  ]);

  return (
    <>
      <section className="hero">
        <span className="hero-eyebrow">Quincaillerie Bochtiba</span>
        <h1>Tout pour vos travaux, au détail et en gros</h1>
        <p>
          Commandez en ligne, choisissez le retrait en magasin ou la livraison, et suivez
          vos commandes en temps réel. Parcourez le catalogue par catégorie et trouvez
          rapidement l’article qu’il vous faut.
        </p>
        <div className="hero-actions">
          <Link href="/produits" className="btn">
            Voir le catalogue
          </Link>
          <Link href="/inscription" className="btn secondary">
            Créer un compte
          </Link>
        </div>
        <div className="hero-highlights">
          <div className="hero-highlight"><strong>{cats.length}</strong><span>catégories</span></div>
          <div className="hero-highlight"><strong>Détail & gros</strong><span>tarifs adaptés</span></div>
          <div className="hero-highlight"><strong>Livraison</strong><span>ou retrait magasin</span></div>
        </div>
      </section>

      <div className="section-head">
        <h2>Nos catégories</h2>
        <p>{cats.length} familles de produits</p>
      </div>
      <div className="grid cats">
        {cats.map((c) => (
          <Link key={c.id} href={`/produits?categorie=${c.id}`} className="card link cat-card">
            <div className="cat-mark" aria-hidden="true">
              <span>{c.nom.charAt(0)}</span>
            </div>
            <div className="cat-body">
              <strong>{c.nom}</strong>
              <span className="muted small">{c._count.produits} articles</span>
            </div>
          </Link>
        ))}
      </div>

      {produits.length > 0 && (
        <>
          <div className="section-head">
            <h2>À découvrir</h2>
            <Link href="/produits" className="muted">
              Tout le catalogue →
            </Link>
          </div>
          <div className="grid products">
            {produits.map((p) => (
              <Link key={p.id} href={`/produits/${p.id}`} className="card link product-card">
                <div className="product-mark" aria-hidden="true">
                  <span>{p.nom.charAt(0)}</span>
                </div>
                <span className="chip">{p.categorie.nom}</span>
                <strong>{p.nom}</strong>
                <span className="price">{p.prixDetail?.toFixed(3)} DT</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
