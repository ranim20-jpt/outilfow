import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import AdminNav from "../../components/AdminNav";
import Flash from "../../components/Flash";
import { basculerActif, basculerDisponible, creerUtilisateur } from "../../actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminUtilisateursPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { nom: "asc" }] });

  return (
    <>
      <h1>Utilisateurs</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>E-mail</th>
              <th>Rôle</th>
              <th>Inscrit le</th>
              <th>Statut</th>
              <th>Disponibilité</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.prenom} {u.nom}
                  {u.raisonSociale && <div className="muted small">{u.raisonSociale}</div>}
                </td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role as Role]}</td>
                <td>{fmtDate(u.createdAt)}</td>
                <td>{u.actif ? <span className="badge ok">Actif</span> : <span className="badge bad">Désactivé</span>}</td>
                <td>
                  {u.role === "LIVREUR" ? (
                    <>
                      <span className={`badge ${u.disponible ? "ok" : "bad"}`}>
                        {u.disponible ? "Disponible" : "Indisponible"}
                      </span>
                      <form action={basculerDisponible}>
                        <input type="hidden" name="id" value={u.id} />
                        <button className="btn secondary small" type="submit">
                          {u.disponible ? "Rendre indisponible" : "Rendre disponible"}
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </td>
                <td>
                  <form action={basculerActif}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="btn secondary small" type="submit">
                      {u.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Créer un utilisateur</h2>
      <form action={creerUtilisateur} className="stack wide card">
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
            <input type="email" name="email" required />
          </label>
          <label>
            Téléphone
            <input name="telephone" />
          </label>
        </div>
        <div className="row">
          <label>
            Mot de passe provisoire
            <input type="password" name="motDePasse" minLength={6} required />
          </label>
          <label>
            Rôle
            <select name="role" defaultValue="LIVREUR">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn" type="submit">
          Créer
        </button>
      </form>
    </>
  );
}
