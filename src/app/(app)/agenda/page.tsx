import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SeloEvento } from "@/components/ui/selos";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import {
  diaDaSemana,
  diasEntre,
  fimDoMes,
  formatarData,
  formatarMesAno,
  hoje,
  somarDias,
  somarMeses,
} from "@/lib/datas";
import { cn } from "@/lib/utils";
import type { StatusEvento } from "@/types";

type EventoMes = {
  id: string;
  titulo: string;
  data_evento: string;
  data_saida: string;
  data_retorno: string;
  status: StatusEvento;
  local: string | null;
};

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const COR: Record<StatusEvento, string> = {
  orcamento: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
  confirmado: "bg-oliva text-white",
  realizado: "bg-gray-200 text-gray-700",
  cancelado: "bg-red-50 text-red-700 line-through",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const dia = hoje();
  const mes = mesParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : dia.slice(0, 7);
  const inicio = `${mes}-01`;
  const fim = fimDoMes(inicio);

  // A grade começa no domingo antes do dia 1 e termina no sábado depois do último dia.
  const inicioGrade = somarDias(inicio, -diaDaSemana(inicio));
  const fimGrade = somarDias(fim, 6 - diaDaSemana(fim));

  const supabase = await createClient();
  const eventos = await buscarTodas<EventoMes>((a, b) =>
    supabase
      .from("eventos")
      .select("id, titulo, data_evento, data_saida, data_retorno, status, local")
      .neq("status", "cancelado")
      .lte("data_saida", fimGrade)
      .gte("data_retorno", inicioGrade)
      .order("data_evento")
      .order("id")
      .range(a, b)
  );

  const noDia = (d: string) => ({
    eventos: eventos.filter((e) => e.data_evento === d),
    saidas: eventos.filter((e) => e.data_saida === d && e.data_saida !== e.data_evento && e.status !== "orcamento"),
    retornos: eventos.filter((e) => e.data_retorno === d && e.status !== "orcamento"),
  });

  const anterior = somarMeses(inicio, -1).slice(0, 7);
  const proximo = somarMeses(inicio, 1).slice(0, 7);
  const eventosDoMes = eventos.filter((e) => e.data_evento >= inicio && e.data_evento <= fim);

  return (
    <>
      <Header
        title="Agenda"
        subtitle="Eventos, saídas e retornos de peças"
        action={
          <Link href="/eventos/novo" className="btn-primario">
            <Plus className="w-4 h-4" /> Novo evento
          </Link>
        }
      />

      <div className="cartao">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/agenda?mes=${anterior}`} className="p-2 rounded-lg hover:bg-fundo" aria-label="Mês anterior">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="text-center">
            <h2 className="font-titulo text-2xl text-oliva-escuro first-letter:uppercase">{formatarMesAno(mes)}</h2>
            {mes !== dia.slice(0, 7) && (
              <Link href="/agenda" className="text-xs text-oliva hover:underline">voltar para hoje</Link>
            )}
          </div>
          <Link href={`/agenda?mes=${proximo}`} className="p-2 rounded-lg hover:bg-fundo" aria-label="Próximo mês">
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Grade (tablet e computador) */}
        <div className="hidden md:grid grid-cols-7 gap-px bg-black/5 rounded-lg overflow-hidden ring-1 ring-black/5">
          {SEMANA.map((s) => (
            <div key={s} className="bg-fundo text-center text-[11px] uppercase tracking-wider text-cinza py-1.5">
              {s}
            </div>
          ))}
          {diasEntre(inicioGrade, fimGrade).map((d) => {
            const { eventos: evs, saidas, retornos } = noDia(d);
            const foraDoMes = d < inicio || d > fim;
            return (
              <div key={d} className={cn("bg-white min-h-28 p-1.5 space-y-1", foraDoMes && "bg-white/60")}>
                <p
                  className={cn(
                    "text-xs valor w-6 h-6 flex items-center justify-center rounded-full",
                    d === dia && "bg-areia text-oliva-escuro font-bold",
                    foraDoMes && "text-black/25"
                  )}
                >
                  {Number(d.slice(8, 10))}
                </p>
                {evs.map((e) => (
                  <Link
                    key={e.id}
                    href={`/eventos/${e.id}`}
                    className={cn("block text-[11px] leading-tight rounded px-1.5 py-1 truncate", COR[e.status])}
                    title={`${e.titulo}${e.local ? ` — ${e.local}` : ""}`}
                  >
                    {e.titulo}
                  </Link>
                ))}
                {saidas.map((e) => (
                  <p key={`s-${e.id}`} className="text-[10px] text-amber-800 truncate" title={`Peças saem: ${e.titulo}`}>
                    ↗ sai: {e.titulo}
                  </p>
                ))}
                {retornos.map((e) => (
                  <p key={`r-${e.id}`} className="text-[10px] text-sky-800 truncate" title={`Peças livres: ${e.titulo}`}>
                    ↙ volta: {e.titulo}
                  </p>
                ))}
              </div>
            );
          })}
        </div>

        {/* Lista (celular) */}
        <ul className="md:hidden divide-y divide-black/5">
          {!eventosDoMes.length && <li className="py-6 text-center text-sm text-cinza">Nenhum evento neste mês.</li>}
          {eventosDoMes.map((e) => (
            <li key={e.id} className="py-3">
              <Link href={`/eventos/${e.id}`} className="flex items-center gap-3">
                <span className="font-titulo text-2xl w-9 text-oliva-escuro">{e.data_evento.slice(8, 10)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-medium truncate">{e.titulo}</span>
                  <span className="block text-xs text-cinza">
                    Peças fora de {formatarData(e.data_saida)} a {formatarData(e.data_retorno)}
                  </span>
                </span>
                <SeloEvento status={e.status} />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-4 mt-4 text-xs text-cinza">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-oliva" /> Confirmado</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 ring-1 ring-amber-200" /> Orçamento (sem reserva)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-200" /> Realizado</span>
          <span>↗ saída das peças · ↙ peças livres de novo</span>
        </div>
      </div>
    </>
  );
}
