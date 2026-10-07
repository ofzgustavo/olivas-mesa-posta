import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PecaForm } from "@/components/acervo/peca-form";
import { createClient } from "@/lib/supabase/server";
import type { PecaEstoque } from "@/types";

export default async function EditarPecaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("pecas_estoque").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <Header title="Editar peça" />
      <PecaForm peca={data as PecaEstoque} />
    </>
  );
}
