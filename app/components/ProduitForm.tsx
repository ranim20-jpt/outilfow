import type { Categorie, Produit } from "@prisma/client";
import { UNITES } from "@/lib/constants";

export default function ProduitForm({
  produit,
  categories,
  action,
}: {
  produit?: Produit | null;
  categories: Categorie[];
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="stack wide card">
      {produit && <input type="hidden" name="id" value={produit.id} />}
      <div className="row">
        <label>
          Nom
          <input name="nom" defaultValue={produit?.nom ?? ""} required />
        </label>
        <label>
          Code article
          <input name="codeStq" defaultValue={produit?.codeStq ?? ""} required />
        </label>
      </div>
      <div className="row">
        <label>
          Catégorie
          <select name="categorieId" defaultValue={produit?.categorieId ?? ""} required>
            <option value="" disabled>
              Choisir…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Unité de vente
          <select name="unite" defaultValue={produit?.unite ?? "pièce"}>
            {UNITES.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Description
        <textarea name="description" rows={2} defaultValue={produit?.description ?? ""} />
      </label>
      <label>
        Image (URL)
        <input name="image" defaultValue={produit?.image ?? ""} placeholder="https://…" />
      </label>
      <div className="row">
        <label>
          Prix de détail (DT, HTVA)
          <input name="prixDetail" type="number" step="0.001" min="0" defaultValue={produit?.prixDetail ?? ""} />
        </label>
        <label>
          Prix de gros (DT, HTVA)
          <input name="prixGros" type="number" step="0.001" min="0" defaultValue={produit?.prixGros ?? ""} />
        </label>
        <label>
          Quantité minimale de gros
          <input name="quantiteMinGros" type="number" min="1" defaultValue={produit?.quantiteMinGros ?? 10} />
        </label>
      </div>
      <div className="row">
        <label>
          Quantité en stock
          <input name="quantiteStock" type="number" min="0" defaultValue={produit?.quantiteStock ?? 0} />
        </label>
        <label>
          Seuil d’alerte stock faible
          <input name="seuilAlerte" type="number" min="0" defaultValue={produit?.seuilAlerte ?? 5} />
        </label>
      </div>
      <label style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
        <input type="checkbox" name="actif" defaultChecked={produit?.actif ?? true} /> Visible dans le catalogue
      </label>
      <button className="btn" type="submit">
        Enregistrer
      </button>
    </form>
  );
}
