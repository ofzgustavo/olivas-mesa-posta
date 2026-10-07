import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { GraficoBarrasHorizontais, GraficoReceitaDespesa } from "@/components/graficos";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { formatarData, formatarMesCurto, hoje, mesesEntre } from "@/lib/datas";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import { CATEGORIAS_DESPESA, type CategoriaDespesa } from "@/types";

type EventoAno = {
  id: string;
  titulo: string;
  tipo_evento: string | null;
  data_evento: string;
  valor_total: number;
  status: string;
  parcelas: { valor: number; tipo: string }[];
  evento_itens: { quantidade: number; pecas: { nome: string } | { nome: string }[] | null }[];
};

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const { ano: anoParam } = await searchParams;
  const anoAtual = hoje().slice(0, 4);
  const ano = anoParam && /^\d{4}$/.test(anoParam) ? anoParam : anoAtual;
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const supabase = await createClient();
  const [recebidas, despesas, eventos] = await Promise.all([
    buscarTodas<{ valor: number; data_recebimento: string }>((a, b) =>
      supabase
        .from("parcelas")
        .select("valor, data_recebimento")
        .eq("status", "recebido")
        .gte("data_recebimento", inicio)
        .lte("data_recebimento", fim)
        .order("id")
        .range(a, b)
    ),
    buscarTodas<{ valor: number; data: string; categoria: CategoriaDespesa; evento_id: string | null }>((a, b) =>
      supabase
        .from("despesas")
        .select("valor, data, categoria, evento_id")
        .gte("data", inicio)
        .lte("data", fim)
        .order("id")
        .range(a, b)
    ),
    // Eventos do ano que aconteceram ou vão acontecer (sem orçamentos e cancelados).
    buscarTodas<EventoAno>((a, b) =>
      supabase
        .from("eventos")
        .select("id, titulo, tipo_evento, data_evento, valor_total, status, parcelas(valor, tipo), evento_itens(quantidade, pecas(nome))")
        .in("status", ["confirmado", "realizado"])
        .gte("data_evento", inicio)
        .lte("data_evento", fim)
        .order("data_evento")
        .order("id")
        .range(a, b)
    ),
  ]);

  // Caixa por mês (o que entrou e saiu de fato)
  const meses = mesesEntre(inicio, fim);
  const rec = new Map<string, number>();
  const desp = new Map<string, number>();
  for (const p of recebidas) rec.set(p.data_recebimento.slice(0, 7), (rec.get(p.data_recebimento.slice(0, 7)) ?? 0) + Number(p.valor));
  for (const d of despesas) desp.set(d.data.slice(0, 7), (desp.get(d.data.slice(0, 7)) ?? 0) + Number(d.valor));
  const serie = meses.map((m) => ({ rotulo: formatarMesCurto(m), receita: rec.get(m) ?? 0, despesa: desp.get(m) ?? 0 }));
  const totalRec = serie.reduce((s, x) => s + x.receita, 0);
  const totalDesp = serie.reduce((s, x) => s + x.despesa, 0);

  // Faturamento por tipo de evento (valor contratado)
  const porTipo = new Map<string, number>();
  for (const e of eventos) {
    const tipo = e.tipo_evento?.trim() || "Sem tipo";
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + Number(e.valor_total));
  }
  const faturamentoPorTipo = [...porTipo.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor);

  // Despesas por categoria
  const porCategoria = new Map<CategoriaDespesa, number>();
  for (const d of despesas) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + Number(d.valor));
  const despesasPorCategoria = [...porCategoria.entries()]
    .map(([c, valor]) => ({ rotulo: CATEGORIAS_DESPESA[c], valor }))
    .sort((a, b) => b.valor - a.valor);

  // Peças mais usadas (unidades somadas nos eventos do ano)
  const usoPecas = new Map<string, number>();
  for (const e of eventos) {
    for (const i of e.evento_itens) {
      const nome = umOuNenhum(i.pecas)?.nome;
      if (nome) usoPecas.set(nome, (usoPecas.get(nome) ?? 0) + i.quantidade);
    }
  }
  const pecasMaisUsadas = [...usoPecas.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  // Resultado por evento: valor + avarias − despesas ligadas ao evento
  const despPorEvento = new Map<string, number>();
  for (const d of despesas) {
    if (d.evento_id) despPorEvento.set(d.evento_id, (despPorEvento.get(d.evento_id) ?? 0) + Number(d.valor));
  }
  const resultados = eventos.map((e) => {
    const avarias = e.parcelas.filter((p) => p.tipo === "avaria").reduce((s, p) => s + Number(p.valor), 0);
    const custo = despPorEvento.get(e.id) ?? 0;
    return { ...e, avarias, custo, resultado: Number(e.valor_total) + avarias - custo };
  });
  const totalContratado = eventos.reduce((s, e) => s + Number(e.valor_total), 0);
  const ticketMedio = eventos.length ? totalContratado / eventos.length : 0;

  return (
    <>
      <Header
        title="Relatórios"
        action={
          <div className="flex items-center gap-1">
            <Link href={`/relatorios?ano=${Number(ano) - 1}`} className="p-2 rounded-lg hover:bg-white" aria-label="Ano anterior">
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <span className="font-titulo text-2xl text-oliva-escuro px-2">{ano}</span>
            <Link href={`/relatorios?ano=${Number(ano) + 1}`} className="p-2 rounded-lg hover:bg-white" aria-label="Próximo ano">
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Numero rotulo="Recebido no ano" valor={formatCurrency(totalRec)} />
          <Numero rotulo="Despesas no ano" valor={formatCurrency(totalDesp)} />
          <Numero
            rotulo="Resultado de caixa"
            valor={formatCurrency(totalRec - totalDesp)}
            cor={totalRec - totalDesp >= 0 ? "text-oliva" : "text-red-600"}
          />
          <Numero rotulo={`${eventos.length} eventos · ticket médio`} valor={formatCurrency(ticketMedio)} />
        </div>

        <GraficoReceitaDespesa titulo="Caixa mês a mês" dados={serie} />

        <div className="grid xl:grid-cols-3 gap-6">
          <GraficoBarrasHorizontais titulo="Faturamento por tipo de evento" dados={faturamentoPorTipo} nomeSerie="Contratado" />
          <GraficoBarrasHorizontais titulo="Despesas por categoria" dados={despesasPorCategoria} nomeSerie="Despesa" />
          <GraficoBarrasHorizontais
            titulo="Peças mais alugadas"
            dados={pecasMaisUsadas}
            formato="numero"
            nomeSerie="Unidades"
          />
        </div>

        <section className="cartao">
          <h2 className="font-titulo text-xl text-oliva-escuro mb-1">Resultado por evento</h2>
          <p className="text-xs text-cinza mb-4">
            Valor do evento + cobranças de avaria − despesas lançadas no evento (frete, reposição…).
            Despesas gerais, como tráfego pago, não entram aqui.
          </p>
          {!resultados.length ? (
            <p className="text-sm text-cinza">Nenhum evento confirmado ou realizado em {ano}.</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-left">
                    <th className="titulo-secao pb-3 px-2">Data</th>
                    <th className="titulo-secao pb-3 px-2">Evento</th>
                    <th className="titulo-secao pb-3 px-2 text-right">Valor</th>
                    <th className="titulo-secao pb-3 px-2 text-right">Avarias</th>
                    <th className="titulo-secao pb-3 px-2 text-right">Despesas</th>
                    <th className="titulo-secao pb-3 px-2 text-right">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {resultados.map((e) => (
                    <tr key={e.id} className="hover:bg-fundo/60">
                      <td className="py-2.5 px-2 text-cinza whitespace-nowrap">{formatarData(e.data_evento)}</td>
                      <td className="py-2.5 px-2">
                        <Link href={`/eventos/${e.id}`} className="hover:text-oliva hover:underline">{e.titulo}</Link>
                      </td>
                      <td className="py-2.5 px-2 text-right valor">{formatCurrency(e.valor_total)}</td>
                      <td className="py-2.5 px-2 text-right valor text-cinza">{e.avarias ? formatCurrency(e.avarias) : "—"}</td>
                      <td className="py-2.5 px-2 text-right valor text-cinza">{e.custo ? formatCurrency(e.custo) : "—"}</td>
                      <td className={cn("py-2.5 px-2 text-right valor font-bold", e.resultado >= 0 ? "text-oliva" : "text-red-600")}>
                        {formatCurrency(e.resultado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="cartao">
      <p className="titulo-secao">{rotulo}</p>
      <p className={cn("text-2xl font-titulo font-semibold mt-2 valor", cor ?? "text-oliva-escuro")}>{valor}</p>
    </div>
  );
}
