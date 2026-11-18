"use client";

import { useState } from "react";
import { FRAIS_LIVRAISON, GOUVERNORATS } from "@/lib/constants";
import { dt } from "@/lib/format";
import MapPicker from "./MapPicker";
import { validerCommande } from "../actions/panier";

type Mode = "RETRAIT" | "LIVRAISON" | "";

/**
 * Formulaire de validation de commande.
 *
 * Aucun mode n'est coché par défaut : le client doit choisir explicitement le
 * retrait ou la livraison. Les champs de livraison n'apparaissent que lorsque
 * « Livraison à domicile » est sélectionné, ce qui évite qu'une commande soit
 * enregistrée en retrait alors que le client a saisi une adresse.
 */
export default function FormulaireCommande({
  sousTotal,
  adresse,
}: {
  sousTotal: string;
  adresse: string;
}) {
  const [mode, setMode] = useState<Mode>("");

  return (
    <form action={validerCommande} className="stack wide card">
      <fieldset className="mode-choice">
        <legend>Mode de récupération</legend>
        <label>
          <input
            type="radio"
            name="mode"
            value="RETRAIT"
            required
            checked={mode === "RETRAIT"}
            onChange={() => setMode("RETRAIT")}
          />
          Retrait en magasin (gratuit)
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            value="LIVRAISON"
            required
            checked={mode === "LIVRAISON"}
            onChange={() => setMode("LIVRAISON")}
          />
          Livraison à domicile (frais : {dt(FRAIS_LIVRAISON)})
        </label>
      </fieldset>

      {mode === "" && (
        <p className="muted small" style={{ margin: 0 }}>
          Choisissez « Retrait en magasin » ou « Livraison à domicile » pour continuer.
        </p>
      )}

      {mode === "LIVRAISON" && (
        <>
          <div className="row">
            <label>
              Gouvernorat
              <select name="gouvernorat" defaultValue="" required>
                <option value="">— Choisir —</option>
                {GOUVERNORATS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ville / localité
              <input name="ville" placeholder="Ex. Nabeul, Hammamet, Tunis…" required minLength={2} />
            </label>
          </div>
          <label>
            Adresse de livraison
            <textarea name="adresse" rows={2} defaultValue={adresse} required minLength={5} />
          </label>
          <div className="map-block">
            <strong>Position exacte (recommandé)</strong>
            <p className="muted small" style={{ margin: 0 }}>
              Placez le repère sur votre adresse : le livreur verra la localisation réelle sur la carte.
            </p>
            <MapPicker />
          </div>
        </>
      )}

      <p className="muted" style={{ margin: 0 }}>
        Sous-total : {sousTotal}.
        {mode === "LIVRAISON"
          ? ` Frais de livraison : ${dt(FRAIS_LIVRAISON)}.`
          : " Les frais de livraison sont ajoutés si vous choisissez la livraison."}
      </p>
      <button className="btn" type="submit">
        Valider la commande
      </button>
    </form>
  );
}
