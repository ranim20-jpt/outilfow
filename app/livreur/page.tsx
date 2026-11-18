import type { Livraison, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { STATUTS_LIVRAISON, labelOf } from "@/lib/constants";
import { dt, fmtDate } from "@/lib/format";
import { estLivraisonNabeul } from "@/lib/livraison";
import Flash from "../components/Flash";
import { majStatutLivraison } from "../actions/livreur";

type SP = Promise<Record<string, string | undefined>>;

type LivraisonComplete = Prisma.LivraisonGetPayload<{
  include: {
    commande: { include: { user: true; lignes: { include: { produit: true } } } };
    historique: true;
  };
}>;

// Statuts qu'un livreur peut appliquer (« En attente » est le statut initial)
const CHOIX = STATUTS_LIVRAISON.filter((s) => s.value !== "EN_ATTENTE");

/** Carte OpenStreetMap centrée sur la position GPS exacte de la livraison. */
function CartePosition({ livraison }: { livraison: Livraison }) {
  const { latitude, longitude, adresseLivraison, ville, gouvernorat, commandeId } = livraison;

  if (latitude === null || longitude === null) {
    const requete = encodeURIComponent(
      [adresseLivraison, ville, gouvernorat, "Tunisie"].filter(Boolean).join(", "),
    );
    return (
      <p className="small muted">
        Position GPS non fournie.{" "}
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${requete}`}
          target="_blank"
          rel="noreferrer"
        >
          Voir l’adresse sur Google Maps ↗
        </a>
      </p>
    );
  }

  const delta = 0.004;
  const bbox = encodeURIComponent(
    `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`,
  );
  const point = encodeURIComponent(`${latitude},${longitude}`);
  const source = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${point}`;

  return (
    <div className="delivery-map-wrap">
      <iframe
        className="delivery-map"
        src={source}
        title={`Localisation de la commande #${commandeId}`}
      />
      <div className="map-tools">
        <span className="muted small">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
        <a
          className="small"
          href={`https://www.google.com/maps/dir/?api=1&destination=${point}`}
          target="_blank"
          rel="noreferrer"
        >
          Ouvrir l’itinéraire ↗
        </a>
      </div>
    </div>
  );
}

export default async function LivreurPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const livreur = await requireUser(["LIVREUR"]);
  const livraisons = await prisma.livraison.findMany({
    where: { livreurId: livreur.id },
    orderBy: { dateAffectation: "desc" },
    include: {
      commande: { include: { user: true, lignes: { include: { produit: true } } } },
      historique: { orderBy: { dateChangement: "asc" } },
    },
  });

  const terminee = (s: string) => s === "LIVREE" || s === "ECHEC";
  const aFaire = livraisons.filter((l) => !terminee(l.statut));
  const finies = livraisons.filter((l) => terminee(l.statut));
  const aNabeul = aFaire.filter((l) => estLivraisonNabeul(l));
  const horsNabeul = aFaire.filter((l) => !estLivraisonNabeul(l));

  const badgeStatut = (statut: string) =>
    statut === "ECHEC" ? "bad" : statut === "EN_COURS" ? "warn" : statut === "LIVREE" ? "ok" : "";

  const carte = (l: LivraisonComplete, avecCarte: boolean) => (
    <div key={l.id} className="card delivery-card">
      <h3>
        Commande #{l.commandeId}{" "}
        <span className={`badge ${badgeStatut(l.statut)}`}>{labelOf(STATUTS_LIVRAISON, l.statut)}</span>
      </h3>

      <p className="small" style={{ margin: 0 }}>
        <span className="badge">{l.gouvernorat ?? "Gouvernorat non précisé"}</span>
        {l.ville && l.ville !== l.gouvernorat && <> · {l.ville}</>}
      </p>

      {avecCarte && <CartePosition livraison={l} />}

      <p style={{ margin: 0 }}>
        <strong>Adresse :</strong> {l.adresseLivraison}
      </p>
      <p style={{ margin: 0 }}>
        <strong>Client :</strong> {l.commande.user.prenom} {l.commande.user.nom}
        {l.commande.user.telephone && (
          <>
            {" · "}
            <a href={`tel:${l.commande.user.telephone.replace(/\s/g, "")}`}>
              {l.commande.user.telephone}
            </a>
          </>
        )}
      </p>
      <ul className="small">
        {l.commande.lignes.map((x) => (
          <li key={x.id}>
            {x.quantite} × {x.produit.nom}
          </li>
        ))}
      </ul>
      <p className="muted small">
        Total commande : {dt(l.commande.total)}
        {l.dateAffectation && ` · affectée le ${fmtDate(l.dateAffectation)}`}
      </p>
      {!terminee(l.statut) && (
        <form action={majStatutLivraison} className="row">
          <input type="hidden" name="livraisonId" value={l.id} />
          <select name="statut" defaultValue={l.statut === "EN_ATTENTE" ? "EN_PREPARATION" : l.statut}>
            {CHOIX.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn shrink" type="submit">
            Mettre à jour
          </button>
        </form>
      )}
      <ul className="timeline">
        {l.historique.map((h) => (
          <li key={h.id} className="small">
            {labelOf(STATUTS_LIVRAISON, h.statut)} — {fmtDate(h.dateChangement)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <h1>Mes livraisons</h1>
      <Flash error={sp.error} ok={sp.ok} />

      <h2>À Nabeul ({aNabeul.length})</h2>
      <p className="muted small">
        Livraisons dans le gouvernorat de Nabeul · la position réelle du client est affichée sur la carte.
      </p>
      {aNabeul.length === 0 ? (
        <p className="card muted">Aucune livraison à effectuer à Nabeul.</p>
      ) : (
        <div className="grid deliveries">{aNabeul.map((l) => carte(l, true))}</div>
      )}

      <h2>Hors Nabeul ({horsNabeul.length})</h2>
      <p className="muted small">Livraisons dans les autres gouvernorats.</p>
      {horsNabeul.length === 0 ? (
        <p className="card muted">Aucune livraison à effectuer hors de Nabeul.</p>
      ) : (
        <div className="grid deliveries">{horsNabeul.map((l) => carte(l, false))}</div>
      )}

      {finies.length > 0 && (
        <>
          <h2>Terminées ({finies.length})</h2>
          <div className="grid deliveries">{finies.map((l) => carte(l, false))}</div>
        </>
      )}
    </>
  );
}
