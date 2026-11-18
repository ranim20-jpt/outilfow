import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import AdminNav from "../../../components/AdminNav";
import Flash from "../../../components/Flash";
import ProduitForm from "../../../components/ProduitForm";
import { enregistrerProduit } from "../../../actions/admin";

type SP = Promise<Record<string, string | undefined>>;

export default async function NouveauProduitPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireUser(["ADMIN"]);
  const categories = await prisma.categorie.findMany({ orderBy: { nom: "asc" } });
  return (
    <>
      <h1>Nouveau produit</h1>
      <AdminNav />
      <Flash error={sp.error} ok={sp.ok} />
      <ProduitForm categories={categories} action={enregistrerProduit} />
    </>
  );
}
