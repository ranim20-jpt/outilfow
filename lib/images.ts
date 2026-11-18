/**
 * Renvoie une URL de photo pour un produit. Chaque article obtient une image
 * stable et distincte (seed) afin que tous les produits aient un visuel.
 * Une image personnalisée enregistrée en base est prioritaire côté affichage.
 */
export function imageProduit(id: number, categorieId: number): string {
  return `https://picsum.photos/seed/outilflow-${categorieId}-${id}/800/600`;
}

/** Image d'illustration pour une catégorie. */
export function imageCategorie(id: number): string {
  return `https://picsum.photos/seed/outilflow-cat-${id}/800/500`;
}

/** Image de fond utilisée pour la bannière d'accueil. */
export const imageHero =
  "https://picsum.photos/seed/outilflow-hero/1600/700";
