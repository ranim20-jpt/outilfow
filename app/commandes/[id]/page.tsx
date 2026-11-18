import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLIENT_ROLES, STATUTS_COMMANDE, STATUTS_LIVRAISON, labelOf } from "@/lib/constants";
import { dt, fmtDate } from "@/lib/format";
import Flash from "../../components/Flash";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function CommandePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(CLIENT_ROLES);
  const commande = await prisma.commande.findFirst({
    where: { id: Number(id) || 0, userId: user.id },
    include: {
      lignes: { include: { produit: true }, orderBy: { id: "asc" } },
      livraison: { include: { livreur: true, historique: { orderBy: { dateChangement: "asc" } } } },
    },
  });
  if (!commande) notFound();

  const l = commande.livraison;
  return (
    <>
      <p>
        <Link href="/commandes">← Mes commandes</Link>
      </p>
      <h1>Commande #{commande.id}</h1>
      <Flash error={sp.error} ok={sp.ok} />
      <p className="muted">
        Passée le {fmtDate(commande.dateCommande)} · {commande.typeVente === "GROS" ? "Vente en gros" : "Vente au détail"} ·{" "}
        {commande.modeRecuperation === "LIVRAISON" ? "Livraison" : "Retrait en magasin"} ·{" "}
        <span className="badge">{labelOf(STATUTS_COMMANDE, commande.statut)}</span>
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Sous-total</th>
            </tr>
          </thead>
          <tbody>
            {commande.lignes.map((x) => (
              <tr key={x.id}>
                <td>
                  <div className="cell-product">
                    <span className="title">{x.produit.nom}</span>
                  </div>
                </td>
                <td>{x.quantite}</td>
                <td>{dt(x.prixUnitaire)}</td>
                <td>{dt(x.sousTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {l && (
        <p className="muted">
          Frais de livraison : {dt(l.fraisLivraison)}
        </p>
      )}
      <p className="total">Total : {dt(commande.total)}</p>

      {l && (
        <div className="card">
          <h3>Suivi de la livraison</h3>
          <p>
            Statut : <span className="badge">{labelOf(STATUTS_LIVRAISON, l.statut)}</span>
          </p>
          <p className="muted small">
            Adresse : {l.adresseLivraison}
            {l.ville && `, ${l.ville}`}
            {l.gouvernorat && ` (${l.gouvernorat})`}
            {l.livreur
              ? ` · Livreur : ${l.livreur.prenom} ${l.livreur.nom}`
              : " · En attente d’affectation à un livreur"}
          </p>
          <ul className="timeline">
            {l.historique.map((h) => (
              <li key={h.id}>
                {labelOf(STATUTS_LIVRAISON, h.statut)} <span className="muted small">— {fmtDate(h.dateChangement)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
