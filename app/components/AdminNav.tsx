
import Link from "next/link";

export default function AdminNav() {
  return (
    <div className="subnav">
      <Link href="/admin">Tableau de bord</Link>
      <Link href="/admin/produits">Produits</Link>
      <Link href="/admin/commandes">Commandes et livraisons</Link>
      <Link href="/admin/utilisateurs">Utilisateurs</Link>
      <Link href="/admin/ml">Intelligence artificielle</Link>
    </div>
  );
}
