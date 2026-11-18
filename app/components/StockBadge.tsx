export default function StockBadge({
  quantiteStock,
  seuilAlerte,
  prixDetail,
}: {
  quantiteStock: number;
  seuilAlerte: number;
  prixDetail: number | null;
}) {
  if (prixDetail === null) return <span className="badge">Prix sur demande</span>;
  if (quantiteStock <= 0) return <span className="badge bad">Rupture</span>;
  if (quantiteStock <= seuilAlerte) return <span className="badge warn">Stock faible</span>;
  return <span className="badge ok">En stock</span>;
}
