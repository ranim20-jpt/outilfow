import Flash from "../components/Flash";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, type Role } from "@/lib/constants";
import { modifierProfil } from "../actions/auth";

type SP = Promise<Record<string, string | undefined>>;

export default async function ProfilPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  return (
    <>
      <h1>Mon profil</h1>
      <p className="muted">
        {ROLE_LABELS[user.role as Role]} · {user.email}
      </p>
      <Flash error={sp.error} ok={sp.ok} />
      <form action={modifierProfil} className="stack wide card">
        <div className="row">
          <label>
            Prénom
            <input name="prenom" defaultValue={user.prenom} required />
          </label>
          <label>
            Nom
            <input name="nom" defaultValue={user.nom} required />
          </label>
        </div>
        <div className="row">
          <label>
            Téléphone
            <input name="telephone" defaultValue={user.telephone ?? ""} />
          </label>
          <label>
            Adresse
            <input name="adresse" defaultValue={user.adresse ?? ""} />
          </label>
        </div>
        {user.role === "PROFESSIONNEL" && (
          <div className="row">
            <label>
              Raison sociale
              <input name="raisonSociale" defaultValue={user.raisonSociale ?? ""} />
            </label>
            <label>
              Matricule fiscal
              <input name="matriculeFiscale" defaultValue={user.matriculeFiscale ?? ""} />
            </label>
          </div>
        )}
        <label>
          Nouveau mot de passe (laisser vide pour ne pas changer)
          <input type="password" name="nouveauMotDePasse" minLength={6} autoComplete="new-password" />
        </label>
        <button className="btn" type="submit">
          Enregistrer
        </button>
      </form>
    </>
  );
}
