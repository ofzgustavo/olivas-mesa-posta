import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Clock, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Header } from "@/components/layout/header";
import { FiltroPainel } from "@/components/painel/filtro-painel";
import { GraficoReceitaDespesa } from "@/components/graficos";
import { SeloParcela } from "@/components/ui/selos";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import {
  diasEntre,
  diferencaEmDias,
  fimDoMes,
  formatarData,
  formatarDiaMes,
  formatarMesAno,
  formatarMesCurto,
  hoje,
  inicioDoMes,
  isDataISO,
  mesesEntre,
  somarDias,
  somarMeses,
} from "@/lib/datas";
import { cn, formatCurrency, isVencido, umOuNenhum } from "@/lib/utils";
import { TIPOS_PARCELA, type TipoParcela } from "@/types";

type Params = { periodo?: string; de?: string; ate?: string };

function lerPeriodo(params: Params, dia: string): { de: string; ate: string; rotulo: string } {
  if (params.periodo === "personalizado" && isDataISO(params.de) && isDataISO(params.ate) && params.de <= params.ate) {
    return { de: params.de, ate: params.ate, rotulo: `${formatarData(params.de)} a ${formatarData(params.ate)}` };
  }
  if (params.periodo === "mes_passado") {
    const mes = somarMeses(inicioDoMes(dia), -1);
    return { de: mes, ate: fimDoMes(mes), rotulo: formatarMesAno(mes) };
  }
  if (params.periodo === "este_ano") {
    return { de: `${dia.slice(0, 4)}-01-01`, ate: `${dia.slice(0, 4)}-12-31`, rotulo: dia.slice(0, 4) };
  }
  return { de: inicioDoMes(dia), ate: fimDoMes(dia), rotulo: formatarMesAno(dia) };
}

type EventoAgenda = {
  id: string;
  titulo: string;
  data_evento: string;
  data_saida: string;
  data_retorno: string;
  status: string;
};

export default async function PainelPage({ searchParams }: { searchParams: Promise<Params> }) {
  const dia = hoje();
  const { de, ate, rotulo } = lerPeriodo(await searchParams, dia);
  const daquiA14 = somarDias(dia, 14);
  const daquiA30 = somarDias(dia, 30);

  const supabase = await createClient();
  const [recebidas, despesas, pendentes, agenda] = await Promise.all([
    buscarTodas<{ valor: number; data_recebimento: string }>((a, b) =>
      supabase
        .from("parcelas")
        .select("valor, data_recebimento")
        .eq("status", "recebido")
        .gte("data_recebimento", de)
        .lte("data_recebimento", ate)
        .order("id")
        .range(a, b)
    ),
    buscarTodas<{ valor: number; data: string }>((a, b) =>
      supabase.from("despesas").select("valor, data").gte("data", de).lte("data", ate).order("id").range(a, b)
    ),
    // Tudo que falta receber, de qualquer data, exceto de evento cancelado.
    buscarTodas<{
      id: string;
      tipo: TipoParcela;
      valor: number;
      status: string;
      data_vencimento: string;
      eventos: { id: string; titulo: string } | { id: string; titulo: string }[] | null;
    }>((a, b) =>
      supabase
        .from("parcelas")
        .select("id, tipo, valor, status, data_vencimento, eventos!inner(id, titulo, status)")
        .eq("status", "pendente")
        .neq("eventos.status", "cancelado")
        .order("data_vencimento")
        .order("id")
        .range(a, b)
    ),
    // Eventos que saem, acontecem ou voltam nos próximos 14 dias.
    buscarTodas<EventoAgenda>((a, b) =>
      supabase
        .from("eventos")
        .select("id, titulo, data_evento, data_saida, data_retorno, status")
        .in("status", ["confirmado", "realizado", "orcamento"])
        .lte("data_saida", daquiA14)
        .gte("data_retorno", dia)
        .order("data_saida")
        .order("id")
        .range(a, b)
    ),
  ]);

  const soma = (l: { valor: number }[]) => l.reduce((s, x) => s + Number(x.valor), 0);
  const receita = soma(recebidas);
  const despesa = soma(despesas);
  const aReceber = soma(pendentes);
  const vencidas = pendentes.filter((p) => isVencido(p.data_vencimento));
  const vencido = soma(vencidas);
  const cobrancasProximas = pendentes.filter((p) => p.data_vencimento <= daquiA30);

  // Série do gráfico: por dia até ~2 meses, por mês acima disso.
  const porDia = diferencaEmDias(de, ate) <= 62;
  const chave = (d: string) => (porDia ? d : d.slice(0, 7));
  const rec = new Map<string, number>();
  const desp = new Map<string, number>();
  for (const p of recebidas) rec.set(chave(p.data_recebimento), (rec.get(chave(p.data_recebimento)) ?? 0) + Number(p.valor));
  for (const d of despesas) desp.set(chave(d.data), (desp.get(chave(d.data)) ?? 0) + Number(d.valor));
  const serie = (porDia ? diasEntre(de, ate) : mesesEntre(de, ate)).map((k) => ({
    rotulo: porDia ? formatarDiaMes(k) : formatarMesCurto(k),
    receita: rec.get(k) ?? 0,
    despesa: desp.get(k) ?? 0,
  }));

  // Agenda logística: um compromisso por data relevante dentro da janela.
  type Compromisso = { data: string; tipo: "sai" | "evento" | "volta"; evento: EventoAgenda };
  const compromissos: Compromisso[] = [];
  for (const e of agenda) {
    if (e.status === "orcamento") continue;
    const add = (data: string, tipo: Compromisso["tipo"]) => {
      if (data >= dia && data <= daquiA14) compromissos.push({ data, tipo, evento: e });
    };
    if (e.data_saida !== e.data_evento) add(e.data_saida, "sai");
    add(e.data_evento, "evento");
    add(e.data_retorno, "volta");
  }
  compromissos.sort((a, b) => a.data.localeCompare(b.data));
  const orcamentosProximos = agenda.filter((e) => e.status === "orcamento");

  return (
    <>
      <Header
        title="Painel"
        subtitle={`Financeiro de ${rotulo}`}
        action={
          <Suspense>
            <FiltroPainel />
          </Suspense>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <Cartao rotulo="Recebido" valor={receita} icone={<TrendingUp className="w-4 h-4 text-emerald-700" />} />
          <Cartao rotulo="Despesas" valor={despesa} icone={<TrendingDown className="w-4 h-4 text-amber-700" />} />
          <Cartao
            rotulo="Resultado"
            valor={receita - despesa}
            icone={<Scale className="w-4 h-4 text-oliva" />}
            cor={receita - despesa >= 0 ? "text-oliva" : "text-red-600"}
            nota="Recebido − despesas"
          />
          <Cartao
            rotulo="A receber"
            valor={aReceber}
            icone={<Clock className="w-4 h-4 text-cinza" />}
            nota="Total pendente, todas as datas"
            href="/receitas?aba=a_receber"
          />
          <Cartao
            rotulo="Vencido"
            valor={vencido}
            icone={<AlertCircle className="w-4 h-4 text-red-600" />}
            cor={vencido > 0 ? "text-red-600" : undefined}
            nota={vencidas.length ? `${vencidas.length} parcela${vencidas.length > 1 ? "s" : ""} em atraso` : "Nada em atraso"}
            href="/receitas?aba=a_receber"
          />
        </div>

        <GraficoReceitaDespesa titulo={`Receitas × despesas — ${rotulo}`} dados={serie} />

        <div className="grid xl:grid-cols-2 gap-6">
          <section className="cartao">
            <h2 className="font-titulo text-xl text-oliva-escuro mb-3">Próximos 14 dias</h2>
            {!compromissos.length ? (
              <p className="text-sm text-cinza">Nenhuma saída, evento ou retorno de peças.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {compromissos.map((c) => (
                  <li key={`${c.evento.id}-${c.tipo}`} className="py-2.5 flex items-center gap-3">
                    <span className="w-14 text-sm valor text-cinza">{formatarDiaMes(c.data)}</span>
                    <span
                      className={cn(
                        "selo w-20 justify-center",
                        c.tipo === "evento" && "bg-oliva text-white",
                        c.tipo === "sai" && "bg-amber-50 text-amber-800",
                        c.tipo === "volta" && "bg-sky-50 text-sky-800"
                      )}
                    >
                      {c.tipo === "sai" ? (
                        <><ArrowUpRight className="w-3 h-3 mr-0.5" />Saída</>
                      ) : c.tipo === "volta" ? (
                        <><ArrowDownLeft className="w-3 h-3 mr-0.5" />Retorno</>
                      ) : (
                        "Evento"
                      )}
                    </span>
                    <Link href={`/eventos/${c.evento.id}`} className="text-sm hover:text-oliva hover:underline truncate">
                      {c.evento.titulo}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {orcamentosProximos.length > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                {orcamentosProximos.length} orçamento{orcamentosProximos.length > 1 ? "s" : ""} para os próximos
                dias ainda sem pagamento — as peças não estão reservadas:{" "}
                {orcamentosProximos.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ", "}
                    <Link href={`/eventos/${e.id}`} className="underline">{e.titulo}</Link>
                  </span>
                ))}
              </p>
            )}
          </section>

          <section className="cartao">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-titulo text-xl text-oliva-escuro">Cobranças até {formatarDiaMes(daquiA30)}</h2>
              <Link href="/receitas?aba=a_receber" className="text-xs text-oliva hover:underline">Ver todas</Link>
            </div>
            {!cobrancasProximas.length ? (
              <p className="text-sm text-cinza">Nenhuma cobrança vencendo.</p>
            ) : (
              <ul className="divide-y divide-black/5">
                {cobrancasProximas.map((p) => {
                  const evento = umOuNenhum(p.eventos);
                  return (
                    <li key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/eventos/${evento?.id}`} className="text-sm hover:text-oliva hover:underline truncate block">
                          {evento?.titulo}
                        </Link>
                        <p className="text-xs text-cinza">
                          {TIPOS_PARCELA[p.tipo]} · vence {formatarData(p.data_vencimento)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <SeloParcela parcela={p} />
                        <span className="valor text-sm font-medium">{formatCurrency(p.valor)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Cartao({
  rotulo,
  valor,
  icone,
  cor,
  nota,
  href,
}: {
  rotulo: string;
  valor: number;
  icone: React.ReactNode;
  cor?: string;
  nota?: string;
  href?: string;
}) {
  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="titulo-secao">{rotulo}</p>
        {icone}
      </div>
      <p className={cn("text-2xl font-titulo font-semibold mt-2 valor", cor ?? "text-oliva-escuro")}>
        {formatCurrency(valor)}
      </p>
      {nota && <p className="text-xs text-cinza mt-1">{nota}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="cartao block hover:ring-1 hover:ring-oliva/30 transition-shadow">
      {conteudo}
    </Link>
  ) : (
    <div className="cartao">{conteudo}</div>
  );
}
