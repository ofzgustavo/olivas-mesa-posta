import type { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import type { Disponibilidade, PecaEstoque } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PecaComDisponibilidade = PecaEstoque & {
  reservado: number;
  disponivel: number;
};

/**
 * Todas as peças com estoque e o que está livre no período. `ignorar` é
 * o evento sendo editado: as peças dele não contam como "já reservadas"
 * para ele mesmo.
 */
export async function carregarAcervo(
  supabase: Supabase,
  inicio: string,
  fim: string,
  ignorar?: string | null
): Promise<PecaComDisponibilidade[]> {
  const [pecas, disp] = await Promise.all([
    buscarTodas<PecaEstoque>((de, ate) =>
      supabase.from("pecas_estoque").select("*").order("nome").order("id").range(de, ate)
    ),
    supabase.rpc("disponibilidade_pecas", {
      p_inicio: inicio,
      p_fim: fim,
      p_ignorar: ignorar ?? null,
    }),
  ]);
  if (disp.error) throw new Error(disp.error.message);

  const porPeca = new Map(
    ((disp.data ?? []) as Disponibilidade[]).map((d) => [d.peca_id, d])
  );
  return pecas.map((p) => {
    const d = porPeca.get(p.id);
    const reservado = d?.reservado ?? 0;
    return { ...p, reservado, disponivel: p.estoque - reservado };
  });
}
