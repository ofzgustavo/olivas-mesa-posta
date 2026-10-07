import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ActionButtons } from "@/components/ui/action-buttons";
import { SeloEvento } from "@/components/ui/selos";
import { createClient } from "@/lib/supabase/server";
import { formatarData, hoje } from "@/lib/datas";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import {
  CATEGORIAS_PECA,
  MOTIVOS_MOVIMENTO,
  type Evento,
  type MovimentoAcervo,
  type PecaEstoque,
} from "@/types";

export default async function PecaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [pecaRes, usoRes, movRes] = await Promise.all([
    supabase.from("pecas_estoque").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("evento_itens")
      .select("quantidade, eventos!inner(id, titulo, data_evento, data_saida, data_retorno, status)")
      .eq("peca_id", id)
      .gte("eventos.data_retorno", hoje())
      .neq("eventos.status", "cancelado"),
    supabase
      .from("movimentos_acervo")
      .select("*")
      .eq("peca_id", id)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!pecaRes.data) notFound();
  const peca = pecaRes.data as PecaEstoque;
  const movimentos = (movRes.data ?? []) as MovimentoAcervo[];
  const usos = (usoRes.data ?? [])
    .map((u) => ({
      quantidade: u.quantidade as number,
      evento: umOuNenhum(u.eventos) as Pick<
        Evento, "id" | "titulo" | "data_evento" | "data_saida" | "data_retorno" | "status"
      > | null,
    }))
    .filter((u) => u.evento)
    .sort((a, b) => a.evento!.data_saida.localeCompare(b.evento!.data_saida));

  return (
    <>
      <Header
        title={peca.nome}
        subtitle={`${CATEGORIAS_PECA[peca.categoria]}${peca.ativo ? "" : " · desativada"}`}
        action={
          <ActionButtons
            editHref={`/acervo/${peca.id}/editar`}
            deleteUrl={`/api/acervo/${peca.id}`}
            deleteConfirmMessage={`Excluir "${peca.nome}"? Só é possível se ela nunca foi usada.`}
            redirectAfterDelete="/acervo"
          />
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="cartao">
          <p className="titulo-secao">No acervo</p>
          <p className="text-3xl font-titulo text-oliva-escuro mt-1 valor">{peca.estoque}</p>
        </div>
        <div className="cartao">
          <p className="titulo-secao">Reposição por unidade</p>
          <p className="text-3xl font-titulo text-oliva-escuro mt-1 valor">
            {peca.valor_reposicao != null ? formatCurrency(peca.valor_reposicao) : "—"}
          </p>
        </div>
        {peca.observacoes && (
          <div className="cartao col-span-2 lg:col-span-1">
            <p className="titulo-secao">Observações</p>
            <p className="text-sm mt-1 whitespace-pre-line">{peca.observacoes}</p>
          </div>
        )}
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="cartao">
          <h2 className="titulo-secao mb-3">Próximos eventos com esta peça</h2>
          {!usos.length ? (
            <p className="text-sm text-cinza">Nenhum evento futuro usa esta peça.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {usos.map(({ evento, quantidade }) => (
                <li key={evento!.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/eventos/${evento!.id}`} className="font-medium hover:text-oliva hover:underline">
                      {evento!.titulo}
                    </Link>
                    <p className="text-xs text-cinza">
                      Fora do acervo de {formatarData(evento!.data_saida)} a {formatarData(evento!.data_retorno)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SeloEvento status={evento!.status} />
                    <span className="valor font-bold">{quantidade} un.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cartao">
          <h2 className="titulo-secao mb-3">Histórico do acervo</h2>
          {!movimentos.length ? (
            <p className="text-sm text-cinza">Sem movimentos.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {movimentos.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p>{MOTIVOS_MOVIMENTO[m.motivo]}</p>
                    <p className="text-xs text-cinza">
                      {formatarData(m.data)}
                      {m.observacao ? ` · ${m.observacao}` : ""}
                    </p>
                  </div>
                  <span className={cn("valor font-bold", m.delta > 0 ? "text-oliva" : "text-red-600")}>
                    {m.delta > 0 ? "+" : ""}
                    {m.delta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
