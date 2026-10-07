import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { createClient } from "@/lib/supabase/server";
import { opcoesDespesa } from "@/lib/opcoes";
import type { Despesa } from "@/types";

export default async function EditarDespesaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("despesas").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const despesa = data as Despesa;
  const { eventos, pecas } = await opcoesDespesa(supabase, despesa.evento_id);

  // Peça desativada continua aparecendo se for a desta despesa.
  if (despesa.peca_id && !pecas.some((p) => p.id === despesa.peca_id)) {
    const { data: peca } = await supabase.from("pecas").select("id, nome").eq("id", despesa.peca_id).maybeSingle();
    if (peca) pecas.push(peca);
  }

  return (
    <>
      <Header title="Editar despesa" />
      <DespesaForm despesa={despesa} eventos={eventos} pecas={pecas} />
    </>
  );
}
