import { Header } from "@/components/layout/header";
import { EventoForm } from "@/components/eventos/evento-form";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";

export default async function NovoEventoPage() {
  const supabase = await createClient();
  const clientes = await buscarTodas<{ id: string; nome: string }>((de, ate) =>
    supabase.from("clientes").select("id, nome").order("nome").order("id").range(de, ate)
  );

  return (
    <>
      <Header title="Novo evento" subtitle="Começa como orçamento; o primeiro pagamento confirma e reserva as peças." />
      <EventoForm clientes={clientes} />
    </>
  );
}
