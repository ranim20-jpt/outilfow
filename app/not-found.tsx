import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <h1>Page introuvable</h1>
      <p className="card">
        La page ou l’élément demandé n’existe pas ou n’est plus disponible.{" "}
        <Link href="/produits">Retour au catalogue</Link>
      </p>
    </>
  );
}
