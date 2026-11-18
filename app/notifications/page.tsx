import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CLIENT_ROLES } from "@/lib/constants";
import { fmtDate } from "@/lib/format";

export default async function NotificationsPage() {
  await requireUser(CLIENT_ROLES);
  const notifications = await prisma.notification.findMany({
    where: { cible: "CLIENT" },
    orderBy: { date: "desc" },
    take: 30,
  });

  return (
    <>
      <div className="section-head">
        <div>
          <h1 style={{ marginBottom: ".2rem" }}>Notifications</h1>
          <p className="muted" style={{ margin: 0 }}>
            Promotions, nouveautés et annonces de la boutique.
          </p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <p className="card empty">Aucune notification pour le moment. Revenez bientôt pour découvrir nos offres.</p>
      ) : (
        <div className="stack wide" style={{ maxWidth: 900 }}>
          {notifications.map((n) => {
            const isPromo = n.type === "PROMO";
            return (
              <article key={n.id} className={`card notif-card ${isPromo ? "promo" : ""}`} style={isPromo ? { borderColor: "#fed7aa", background: "#fffbf7" } : undefined}>
                <div className="notif-head">
                  <span className={`badge ${isPromo ? "gros" : ""}`}>{isPromo ? "Promo" : "Annonce"}</span>
                  {n.titre && <strong>{n.titre}</strong>}
                  <span className="muted small" style={{ marginLeft: "auto" }}>{fmtDate(n.date)}</span>
                </div>
                <p style={{ margin: 0 }}>{n.message}</p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
