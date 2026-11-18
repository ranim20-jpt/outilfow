import Link from "next/link";
import Flash from "../components/Flash";
import { inscription } from "../actions/auth";

type SP = Promise<Record<string, string | undefined>>;

export default async function InscriptionPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Créer un compte</h1>
      <Flash error={sp.error} ok={sp.ok} />
      <form action={inscription} className="stack wide card">
        <label>
          Type de compte
          <select name="role" defaultValue="PARTICULIER">
            <option value="PARTICULIER">Client particulier (prix de détail)</option>
            <option value="PROFESSIONNEL">Client professionnel (prix de gros dès la quantité minimale)</option>
          </select>
        </label>
        <div className="row">
          <label>
            Prénom
            <input name="prenom" required />
          </label>
          <label>
            Nom
            <input name="nom" required />
          </label>
        </div>
        <div className="row">
          <label>
            E-mail
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Téléphone
            <input name="telephone" />
          </label>
        </div>
        <label>
          Adresse
          <input name="adresse" placeholder="Utilisée par défaut pour les livraisons" />
        </label>
        <div className="row">
          <label>
            Mot de passe
            <input type="password" name="motDePasse" required minLength={6} autoComplete="new-password" />
          </label>
          <label>
            Confirmation
            <input type="password" name="confirmation" required minLength={6} autoComplete="new-password" />
          </label>
        </div>
        <fieldset style={{ border: "1px dashed var(--line)", borderRadius: 10 }}>
          <legend className="muted small">Uniquement pour un compte professionnel</legend>
          <div className="row">
            <label>
              Raison sociale
              <input name="raisonSociale" />
            </label>
            <label>
              Matricule fiscal
              <input name="matriculeFiscale" />
            </label>
          </div>
        </fieldset>
        <button className="btn" type="submit">
          Créer mon compte
        </button>
        <p className="muted small">
          Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
        </p>
      </form>
    </>
  );
}
