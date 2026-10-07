import { Suspense } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { FiltroPeriodo } from "@/components/ui/filtro-periodo";
import { SeloParcela } from "@/components/ui/selos";
import { Vazio } from "@/components/ui/vazio";
import { ParcelaAcoes } from "@/components/eventos/parcela-acoes";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { fimDoMes, formatarData, hoje, inicioDoMes, isDataISO } from "@/lib/datas";
import { cn, formatCurrency, isVencido, umOuNenhum } from "@/lib/utils";
import { TIPOS_PARCELA, type TipoParcela } from "@/types";

type EventoEmbed = { id: string; titulo: string; status: string; clientes: { nome: string } | { nome: string }[] | null };
type Linha = {
  id: string;
  tipo: TipoParcela;
  valor: number;
  status: "pendente" | "recebido";
  data_vencimento: string;
  data_recebimento: string | null;
  eventos: EventoEmbed | EventoEmbed[] | null;
};

const SELECT = "id, tipo, valor, status, data_vencimento, data_recebimento, eventos!inner(id, titulo, status, clientes(nome))";

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; inicio?: string; fim?: string }>;
}) {
  const params = await searchParams;
  const aba = params.aba === "a_receber" ? "a_receber" : "recebidas";
  const dia = hoje();
  const inicio = isDataISO(params.inicio) ? params.inicio : inicioDoMes(dia);
  const fim = isDataISO(params.fim) && params.fim >= inicio ? params.fim : fimDoMes(inicio);

  const supabase = await createClient();
  const parcelas =
    aba === "recebidas"
      ? await buscarTodas<Linha>((de, ate) =>
          supabase
            .from("parcelas")
            .select(SELECT)
            .eq("status", "recebido")
            .gte("data_recebimento", inicio)
            .lte("data_recebimento", fim)
            .order("data_recebimento", { ascending: false })
            .order("id")
            .range(de, ate)
        )
      : // A receber: tudo pendente, de qualquer data — o que importa é cobrar.
        // Parcela de evento cancelado não é mais cobrança.
        await buscarTodas<Linha>((de, ate) =>
          supabase
            .from("parcelas")
            .select(SELECT)
            .eq("status", "pendente")
            .neq("eventos.status", "cancelado")
            .order("data_vencimento")
            .order("id")
            .range(de, ate)
        );

  const total = parcelas.reduce((s, p) => s + Number(p.valor), 0);
  const vencido = parcelas
    .filter((p) => p.status === "pendente" && isVencido(p.data_vencimento))
    .reduce((s, p) => s + Number(p.valor), 0);

  return (
    <>
      <Header
        title="Receitas"
        subtitle={
          aba === "recebidas"
            ? `Recebido de ${formatarData(inicio)} a ${formatarData(fim)}: ${formatCurrency(total)}`
            : `A receber: ${formatCurrency(total)}${vencido > 0 ? ` · vencido: ${formatCurrency(vencido)}` : ""}`
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <nav className="flex gap-1.5">
          {([
            ["recebidas", "Recebidas"],
            ["a_receber", "A receber"],
          ] as const).map(([a, rotulo]) => (
            <Link
              key={a}
              href={`/receitas?aba=${a}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium",
                a === aba ? "bg-oliva text-white" : "bg-white border border-black/10 text-cinza hover:border-oliva"
              )}
            >
              {rotulo}
            </Link>
          ))}
        </nav>
        {aba === "recebidas" && (
          <Suspense>
            <FiltroPeriodo inicio={inicio} fim={fim} />
          </Suspense>
        )}
      </div>

      <div className="cartao">
        {!parcelas.length ? (
          <Vazio icone={TrendingUp}>
            {aba === "recebidas" ? "Nenhum recebimento no período." : "Nada a receber. 🎉"}
          </Vazio>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left">
                  <th className="titulo-secao pb-3 px-2">{aba === "recebidas" ? "Recebido em" : "Vencimento"}</th>
                  <th className="titulo-secao pb-3 px-2">Evento</th>
                  <th className="titulo-secao pb-3 px-2">Cliente</th>
                  <th className="titulo-secao pb-3 px-2">Tipo</th>
                  <th className="titulo-secao pb-3 px-2 text-right">Valor</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {parcelas.map((p) => {
                  const evento = umOuNenhum(p.eventos);
                  const cliente = umOuNenhum(evento?.clientes);
                  return (
                    <tr key={p.id} className="hover:bg-fundo/60">
                      <td className="py-3 px-2 whitespace-nowrap">
                        {aba === "recebidas" ? (
                          formatarData(p.data_recebimento)
                        ) : (
                          <span className="flex items-center gap-2">
                            {formatarData(p.data_vencimento)} <SeloParcela parcela={p} />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {evento && (
                          <Link href={`/eventos/${evento.id}`} className="hover:text-oliva hover:underline">
                            {evento.titulo}
                          </Link>
                        )}
                      </td>
                      <td className="py-3 px-2 text-cinza">{cliente?.nome ?? "—"}</td>
                      <td className="py-3 px-2 text-cinza">{TIPOS_PARCELA[p.tipo]}</td>
                      <td className="py-3 px-2 text-right valor font-medium whitespace-nowrap">
                        {formatCurrency(p.valor)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex justify-end">
                          <ParcelaAcoes parcelaId={p.id} recebida={p.status === "recebido"} />
                        </div>
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
