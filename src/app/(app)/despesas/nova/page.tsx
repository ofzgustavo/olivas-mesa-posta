import { Header } from "@/components/layout/header";
import { DespesaForm } from "@/components/despesas/despesa-form";
import { createClient } from "@/lib/supabase/server";
import { opcoesDespesa } from "@/lib/opcoes";
import { uuid } from "@/lib/api";

export default async function NovaDespesaPage({
  searchParams,
}: {
  searchParams: Promise<{ evento?: string }>;
}) {
  const eventoInicial = uuid((await searchParams).evento) ?? undefined;
  const supabase = await createClient();
  const { eventos, pecas } = await opcoesDespesa(supabase, eventoInicial);

  return (
    <>
      <Header title="Nova despesa" />
      <DespesaForm eventos={eventos} pecas={pecas} eventoInicial={eventoInicial} />
    </>
  );
}
