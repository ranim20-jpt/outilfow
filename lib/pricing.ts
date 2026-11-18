export type Tarif = "DETAIL" | "GROS";

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

type ProduitPrix = {
  prixDetail: number | null;
  prixGros: number | null;
  quantiteMinGros: number;
};

/**
 * Règle de tarification : le prix de gros s'applique uniquement aux clients
 * professionnels, dès que la quantité atteint la quantité minimale du produit.
 */
export function calculerPrix(p: ProduitPrix, quantite: number, role?: string | null) {
  const gros =
    role === "PROFESSIONNEL" &&
    p.prixDetail !== null &&
    p.prixGros !== null &&
    quantite >= p.quantiteMinGros;
  const prixUnitaire = gros ? p.prixGros : p.prixDetail;
  return {
    tarif: (gros ? "GROS" : "DETAIL") as Tarif,
    prixUnitaire,
    sousTotal: prixUnitaire === null ? null : round3(prixUnitaire * quantite),
  };
}
