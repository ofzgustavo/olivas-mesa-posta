import { Suspense } from "react";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ActionButtons } from "@/components/ui/action-buttons";
import { FiltroPeriodo } from "@/components/ui/filtro-periodo";
import { Vazio } from "@/components/ui/vazio";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { fimDoMes, formatarData, hoje, inicioDoMes, isDataISO } from "@/lib/datas";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import { CATEGORIAS_DESPESA, type CategoriaDespesa } from "@/types";

type Linha = {
  id: string;
  data: string;
  valor: number;
  categoria: CategoriaDespesa;
  descricao: string;
  quantidade_pecas: number | null;
  eventos: { id: string; titulo: string } | { id: string; titulo: string }[] | null;
  pecas: { nome: string } | { nome: string }[] | null;
};

export default async function DespesasPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string; categoria?: string }>;
}) {
  const params = await searchParams;
  const dia = hoje();
  const inicio = isDataISO(params.inicio) ? params.inicio : inicioDoMes(dia);
  const fim = isDataISO(params.fim) && params.fim >= inicio ? params.fim : fimDoMes(inicio);
  const categoria =
    params.categoria && params.categoria in CATEGORIAS_DESPESA ? (params.categoria as CategoriaDespesa) : null;

  const supabase = await createClient();
  const despesas = await buscarTodas<Linha>((de, ate) => {
    let q = supabase
      .from("despesas")
      .select("id, data, valor, categoria, descricao, quantidade_pecas, eventos(id, titulo), pecas(nome)")
      .gte("data", inicio)
      .lte("data", fim);
    if (categoria) q = q.eq("categoria", categoria);
    return q.order("data", { ascending: false }).order("id").range(de, ate);
  });

  const total = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const porCategoria = new Map<CategoriaDespesa, number>();
  for (const d of despesas) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + Number(d.valor));

  const link = (cat: CategoriaDespesa | null) => {
    const p = new URLSearchParams({ inicio, fim });
    if (cat) p.set("categoria", cat);
    return `/despesas?${p}`;
  };

  return (
    <>
      <Header
        title="Despesas"
        subtitle={`${formatarData(inicio)} a ${formatarData(fim)} · total ${formatCurrency(total)}`}
        action={
          <Link href="/despesas/nova" className="btn-primario">
            <Plus className="w-4 h-4" />
            Nova despesa
          </Link>
        }
      />

      <div className="cartao mb-4 space-y-3">
        <Suspense>
          <FiltroPeriodo inicio={inicio} fim={fim} />
        </Suspense>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={link(null)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              !categoria ? "bg-oliva text-white" : "bg-fundo text-cinza hover:text-oliva"
            )}
          >
            Todas
          </Link>
          {(Object.keys(CATEGORIAS_DESPESA) as CategoriaDespesa[]).map((c) => (
            <Link
              key={c}
              href={link(c)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                categoria === c ? "bg-oliva text-white" : "bg-fundo text-cinza hover:text-oliva"
              )}
            >
              {CATEGORIAS_DESPESA[c]}
              {!categoria && porCategoria.get(c) ? ` · ${formatCurrency(porCategoria.get(c))}` : ""}
            </Link>
          ))}
        </div>
      </div>

      <div className="cartao">
        {!despesas.length ? (
          <Vazio icone={Receipt}>Nenhuma despesa no período.</Vazio>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left">
                  <th className="titulo-secao pb-3 px-2">Data</th>
                  <th className="titulo-secao pb-3 px-2">Descrição</th>
                  <th className="titulo-secao pb-3 px-2">Categoria</th>
                  <th className="titulo-secao pb-3 px-2">Evento</th>
                  <th className="titulo-secao pb-3 px-2 text-right">Valor</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {despesas.map((d) => {
                  const evento = umOuNenhum(d.eventos);
                  const peca = umOuNenhum(d.pecas);
                  return (
                    <tr key={d.id} className="hover:bg-fundo/60">
                      <td className="py-3 px-2 text-cinza whitespace-nowrap">{formatarData(d.data)}</td>
                      <td className="py-3 px-2">
                        {d.descricao}
                        {peca && (
                          <span className="block text-xs text-oliva">
                            +{d.quantidade_pecas} {peca.nome} no acervo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-cinza whitespace-nowrap">{CATEGORIAS_DESPESA[d.categoria]}</td>
                      <td className="py-3 px-2">
                        {evento ? (
                          <Link href={`/eventos/${evento.id}`} className="hover:text-oliva hover:underline">
                            {evento.titulo}
                          </Link>
                        ) : (
                          <span className="text-cinza">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right valor font-medium whitespace-nowrap">
                        {formatCurrency(d.valor)}
                      </td>
                      <td className="py-3 px-2">
                        <ActionButtons
                          editHref={`/despesas/${d.id}/editar`}
                          deleteUrl={`/api/despesas/${d.id}`}
                          deleteConfirmMessage={
                            peca
                              ? "Excluir a despesa? As peças que ela colocou no acervo também saem."
                              : "Excluir esta despesa?"
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-black/10">
                  <td colSpan={4} className="pt-3 px-2 titulo-secao">Total</td>
                  <td className="pt-3 px-2 text-right valor font-bold">{formatCurrency(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
