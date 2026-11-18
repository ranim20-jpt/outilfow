import Link from "next/link";
import Flash from "../components/Flash";
import { connexion } from "../actions/auth";

type SP = Promise<Record<string, string | undefined>>;

export default async function ConnexionPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  return (
    <>
      <h1>Connexion</h1>
      <Flash error={sp.error} ok={sp.ok} />
      <form action={connexion} className="stack card">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <label>
          E-mail
          <input type="email" name="email" required autoComplete="email" />
        </label>
        <label>
          Mot de passe
          <input type="password" name="motDePasse" required autoComplete="current-password" />
        </label>
        <button className="btn" type="submit">
          Se connecter
        </button>
        <p className="muted small">
          Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
        </p>
      </form>
    </>
  );
}
