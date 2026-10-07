import type { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { hoje, somarDias } from "@/lib/datas";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Opções dos selects do formulário de despesa: eventos de 6 meses atrás
// em diante (despesa costuma ser de evento recente ou próximo) e peças
// ativas. O evento já vinculado entra mesmo se for mais antigo.
export async function opcoesDespesa(supabase: Supabase, eventoAtual?: string | null) {
  const [eventos, pecas] = await Promise.all([
    buscarTodas<{ id: string; titulo: string; data_evento: string }>((de, ate) => {
      let q = supabase.from("eventos").select("id, titulo, data_evento").neq("status", "cancelado");
      q = eventoAtual
        ? q.or(`data_evento.gte.${somarDias(hoje(), -180)},id.eq.${eventoAtual}`)
        : q.gte("data_evento", somarDias(hoje(), -180));
      return q.order("data_evento", { ascending: false }).order("id").range(de, ate);
    }),
    buscarTodas<{ id: string; nome: string }>((de, ate) =>
      supabase.from("pecas").select("id, nome").eq("ativo", true).order("nome").order("id").range(de, ate)
    ),
  ]);
  return { eventos, pecas };
}
