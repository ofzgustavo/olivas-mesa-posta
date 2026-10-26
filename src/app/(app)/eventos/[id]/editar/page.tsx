import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { EventoForm } from "@/components/eventos/evento-form";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";

export default async function EditarEventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [eventoRes, clientes] = await Promise.all([
    supabase
      .from("eventos")
      .select("*, evento_itens(peca_id, quantidade, valor_unitario), parcelas(*)")
      .eq("id", id)
      .maybeSingle(),
    buscarTodas<{ id: string; nome: string }>((de, ate) =>
      supabase.from("clientes").select("id, nome").order("nome").order("id").range(de, ate)
    ),
  ]);
  if (!eventoRes.data) notFound();

  return (
    <>
      <Header title="Editar evento" subtitle={eventoRes.data.titulo} />
      <EventoForm clientes={clientes} evento={eventoRes.data} />
    </>
  );
}
