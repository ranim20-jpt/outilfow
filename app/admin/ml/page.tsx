
import { requireUser } from "@/lib/auth";
import AdminNav from "../../components/AdminNav";

export default async function MLPage() {
  await requireUser(["ADMIN"]);

  return (
    <>
      <h1>Intelligence artificielle</h1>
      <AdminNav />

      <p className="muted" style={{ maxWidth: 700 }}>
        Espace de suivi des modèles de Machine Learning de Quincaillerie Bochtiba
        (prévisions et risques basés sur le dataset <code>ml/</code>).
      </p>

      <section className="grid stats">
        <article className="card stat">
          <h3 style={{ margin: "0 0 .3rem" }}>Échecs de livraison</h3>
          <p className="muted" style={{ margin: 0 }}>Prédiction du risque d’échec de livraison.</p>
        </article>

        <article className="card stat">
          <h3 style={{ margin: "0 0 .3rem" }}>Ruptures de stock</h3>
          <p className="muted" style={{ margin: 0 }}>Détection des produits à risque de rupture.</p>
        </article>

        <article className="card stat">
          <h3 style={{ margin: "0 0 .3rem" }}>Demande hebdomadaire</h3>
          <p className="muted" style={{ margin: 0 }}>Prévision des quantités demandées.</p>
        </article>

        <article className="card stat">
          <h3 style={{ margin: "0 0 .3rem" }}>Chiffre d’affaires</h3>
          <p className="muted" style={{ margin: 0 }}>Prévision du chiffre d’affaires journalier.</p>
        </article>
      </section>
    </>
  );
}
