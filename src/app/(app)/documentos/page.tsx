import Link from "next/link";
import { FilePenLine, FileText, Plus, ReceiptText, Search } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SeloEvento } from "@/components/ui/selos";
import { Vazio } from "@/components/ui/vazio";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { formatarData, hoje } from "@/lib/datas";
import { numeroDocumento } from "@/lib/documentos";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import type { StatusEvento } from "@/types";

const ABAS = {
  proximos: "Próximos",
  orcamentos: "Orçamentos",
  passados: "Passados",
  todos: "Todos",
} as const;
type Aba = keyof typeof ABAS;

type Linha = {
  id: string;
  numero: number;
  titulo: string;
  data_evento: string;
  status: StatusEvento;
  valor_total: number;
  clientes: { nome: string } | { nome: string }[] | null;
};

const DOCUMENTOS = [
  { tipo: "orcamento", rotulo: "Orçamento", icone: FileText },
  { tipo: "contrato", rotulo: "Contrato", icone: FilePenLine },
  { tipo: "recibo", rotulo: "Recibo", icone: ReceiptText },
] as const;

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; q?: string }>;
}) {
  const params = await searchParams;
  const aba: Aba = params.aba && params.aba in ABAS ? (params.aba as Aba) : "proximos";
  const busca = (params.q ?? "").trim();
  const dia = hoje();

  const supabase = await createClient();
  const todos = await buscarTodas<Linha>((de, ate) => {
    let q = supabase
      .from("eventos")
      .select("id, numero, titulo, data_evento, status, valor_total, clientes(nome)");
    if (aba === "proximos") q = q.gte("data_evento", dia).neq("status", "cancelado");
    if (aba === "orcamentos") q = q.eq("status", "orcamento");
    if (aba === "passados") q = q.lt("data_evento", dia).neq("status", "cancelado");
    const crescente = aba === "proximos" || aba === "orcamentos";
    return q.order("data_evento", { ascending: crescente }).order("id").range(de, ate);
  });

  // A busca olha o nome do evento, o do cliente e o número do documento.
  const termo = busca.toLocaleLowerCase("pt-BR");
  const eventos = termo
    ? todos.filter((e) =>
        [e.titulo, umOuNenhum(e.clientes)?.nome ?? "", numeroDocumento(e.numero)].some((t) =>
          t.toLocaleLowerCase("pt-BR").includes(termo)
        )
      )
    : todos;

  return (
    <>
      <Header
        title="Documentos"
        subtitle="Orçamento, contrato e recibo de entrega de cada evento, prontos para imprimir ou salvar em PDF."
        action={
          <Link href="/eventos/novo" className="btn-primario">
            <Plus className="w-4 h-4" />
            Novo orçamento
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <nav className="flex flex-wrap gap-1.5">
          {(Object.keys(ABAS) as Aba[]).map((a) => (
            <Link
              key={a}
              href={`/documentos?aba=${a}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                a === aba ? "bg-oliva text-white" : "bg-white border border-black/10 text-cinza hover:border-oliva"
              )}
            >
              {ABAS[a]}
            </Link>
          ))}
        </nav>
        <form className="relative">
          <input type="hidden" name="aba" value={aba} />
          <Search className="w-3.5 h-3.5 text-cinza absolute left-3 top-1/2 -translate-y-1/2" />
          <input name="q" defaultValue={busca} placeholder="Cliente, evento ou nº…" className="campo pl-8 py-1.5 w-56" />
        </form>
      </div>

      <div className="cartao">
        {!eventos.length ? (
          <Vazio icone={FileText}>
            {busca ? "Nenhum evento encontrado." : "Nenhum evento aqui ainda."}
          </Vazio>
        ) : (
          <ul className="divide-y divide-black/5 -my-2">
            {eventos.map((e) => {
              const cliente = umOuNenhum(e.clientes);
              const cancelado = e.status === "cancelado";
              return (
                <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="w-20 shrink-0 text-center">
                    <p className="font-titulo text-2xl leading-none text-oliva-escuro">{e.data_evento.slice(8, 10)}</p>
                    <p className="text-[11px] uppercase tracking-wider text-cinza">
                      {formatarData(e.data_evento).slice(3)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-48">
                    <Link href={`/eventos/${e.id}`} className="font-medium hover:text-oliva hover:underline">
                      {cliente?.nome ?? e.titulo}
                    </Link>
                    <p className="text-xs text-cinza">
                      Nº {numeroDocumento(e.numero)} · {e.titulo} ·{" "}
                      <span className="valor">{formatCurrency(e.valor_total)}</span>
                    </p>
                  </div>
                  <SeloEvento status={e.status} />
                  <div className="flex flex-wrap gap-1.5">
                    {DOCUMENTOS.filter((d) => !cancelado || d.tipo === "orcamento").map(
                      ({ tipo, rotulo, icone: Icone }) => (
                        <Link key={tipo} href={`/documentos/${e.id}/${tipo}`} className="btn-contorno px-3 py-1.5">
                          <Icone className="w-4 h-4" /> {rotulo}
                        </Link>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
