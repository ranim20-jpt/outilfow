import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AdminNav from "../../../components/AdminNav";
import Flash from "../../../components/Flash";
import ConfirmButton from "../../../components/ConfirmButton";
import ProduitForm from "../../../components/ProduitForm";
import { enregistrerProduit, supprimerProduit } from "../../../actions/admin";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ModifierProduitPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const [produit, categories] = await Promise.all([
    prisma.produit.findUnique({ where: { id: Number(id) || 0 } }),
    prisma.categorie.findMany({ orderBy: { nom: "asc" } }),
  ]);
  if (!produit) notFound();

  return (
    <>
      <h1>Modifier : {produit.nom}</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />
      <ProduitForm produit={produit} categories={categories} action={enregistrerProduit} />
      <form action={supprimerProduit} style={{ marginTop: "1rem" }}>
        <input type="hidden" name="id" value={produit.id} />
        <ConfirmButton
          className="btn danger"
          confirm={`Supprimer le produit « ${produit.nom} » ? S’il a déjà été commandé, il sera archivé.`}
        >
          Supprimer ce produit
        </ConfirmButton>
        <span className="muted small"> (si le produit a déjà été commandé, il est archivé)</span>
      </form>
    </>
  );
}
