import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { CLIENT_ROLES } from "@/lib/constants";
import { dt } from "@/lib/format";
import { chargerPanier } from "@/lib/panier";
import Flash from "../components/Flash";
import FormulaireCommande from "../components/FormulaireCommande";
import { modifierQuantite, retirerDuPanier } from "../actions/panier";

type SP = Promise<Record<string, string | undefined>>;

export default async function PanierPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser(CLIENT_ROLES);
  const { lignes, sousTotal } = await chargerPanier(user.id, user.role);

  return (
    <>
      <h1>Mon panier</h1>
      <Flash error={sp.error} ok={sp.ok} />
      {lignes.length === 0 ? (
        <p className="card">
          Votre panier est vide. <Link href="/produits">Parcourir le catalogue</Link>
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Quantité</th>
                  <th>Prix unitaire</th>
                  <th>Sous-total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => {
                  const manque =
                    user.role === "PROFESSIONNEL" &&
                    l.tarif === "DETAIL" &&
                    l.produit.prixGros !== null &&
                    l.produit.quantiteMinGros > l.quantite
                      ? l.produit.quantiteMinGros - l.quantite
                      : 0;
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="cell-product">
                          <div>
                            <Link href={`/produits/${l.produitId}`} className="title">{l.produit.nom}</Link>
                            <div className="muted small">Stock disponible : {l.produit.quantiteStock}</div>
                            {manque > 0 && (
                              <div className="small" style={{ color: "var(--accent)" }}>
                                Plus que {manque} {l.produit.unite} pour le prix de gros ({dt(l.produit.prixGros)})
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <form action={modifierQuantite}>
                          <input type="hidden" name="ligneId" value={l.id} />
                          <input type="number" name="quantite" min={0} defaultValue={l.quantite} style={{ width: 90 }} />
                          <button className="btn secondary small" type="submit">
                            OK
                          </button>
                        </form>
                      </td>
                      <td>
                        {dt(l.prixUnitaire)} {l.tarif === "GROS" && <span className="badge gros">Gros</span>}
                      </td>
                      <td>{dt(l.sousTotal)}</td>
                      <td>
                        <form action={retirerDuPanier}>
                          <input type="hidden" name="ligneId" value={l.id} />
                          <button className="btn danger small" type="submit">
                            Retirer
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2>Finaliser la commande</h2>
          <FormulaireCommande sousTotal={dt(sousTotal)} adresse={user.adresse ?? ""} />
        </>
      )}
    </>
  );
}
