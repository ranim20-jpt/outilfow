import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLIENT_ROLES, STATUTS_COMMANDE, STATUTS_LIVRAISON, labelOf } from "@/lib/constants";
import { dt, fmtDate } from "@/lib/format";

export default async function MesCommandesPage() {
  const user = await requireUser(CLIENT_ROLES);
  const commandes = await prisma.commande.findMany({
    where: { userId: user.id },
    orderBy: { dateCommande: "desc" },
    include: { livraison: true, _count: { select: { lignes: true } } },
  });

  return (
    <>
      <h1>Mes commandes</h1>
      {commandes.length === 0 ? (
        <p className="card">
          Aucune commande pour le moment. <Link href="/produits">Parcourir le catalogue</Link>
        </p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Articles</th>
                <th>Mode</th>
                <th>Total</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {commandes.map((c) => (
                <tr key={c.id}>
                  <td>#{c.id}</td>
                  <td>{fmtDate(c.dateCommande)}</td>
                  <td>{c._count.lignes}</td>
                  <td>{c.modeRecuperation === "LIVRAISON" ? "Livraison" : "Retrait en magasin"}</td>
                  <td>{dt(c.total)}</td>
                  <td>
                    <span className="badge">{labelOf(STATUTS_COMMANDE, c.statut)}</span>
                    {c.livraison && (
                      <div className="muted small">Livraison : {labelOf(STATUTS_LIVRAISON, c.livraison.statut)}</div>
                    )}
                  </td>
                  <td>
                    <Link href={`/commandes/${c.id}`}>Détails</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
