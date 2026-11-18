import type { Prisma } from "@prisma/client";

/** Crée une notification admin si le produit est en stock faible ou en rupture. */
export async function notifierStock(tx: Prisma.TransactionClient, produitId: number) {
  const p = await tx.produit.findUnique({ where: { id: produitId } });
  if (!p) return;
  const dejaSignale = async (type: "RUPTURE" | "STOCK_FAIBLE") =>
    (await tx.notification.count({ where: { produitId: p.id, type, cible: "ADMIN", lue: false } })) > 0;

  if (p.quantiteStock <= 0) {
    if (await dejaSignale("RUPTURE")) return;
    await tx.notification.create({
      data: {
        type: "RUPTURE",
        cible: "ADMIN",
        produitId: p.id,
        message: `Rupture de stock : ${p.nom}`,
      },
    });
  } else if (p.quantiteStock <= p.seuilAlerte) {
    if (await dejaSignale("STOCK_FAIBLE")) return;
    await tx.notification.create({
      data: {
        type: "STOCK_FAIBLE",
        cible: "ADMIN",
        produitId: p.id,
        message: `Stock faible : ${p.nom} (${p.quantiteStock} restant${p.quantiteStock > 1 ? "s" : ""})`,
      },
    });
  }
}
