import Link from "next/link";
import { PartyPopper, Plus, Search } from "lucide-react";
import { Header } from "@/components/layout/header";
import { SeloEvento } from "@/components/ui/selos";
import { Vazio } from "@/components/ui/vazio";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { formatarData, hoje } from "@/lib/datas";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import type { StatusEvento } from "@/types";

const ABAS = {
  proximos: "Próximos",
  orcamentos: "Orçamentos",
  passados: "Passados",
  cancelados: "Cancelados",
  todos: "Todos",
} as const;
type Aba = keyof typeof ABAS;

type Linha = {
  id: string;
  titulo: string;
  tipo_evento: string | null;
  data_evento: string;
  local: string | null;
  status: StatusEvento;
  valor_total: number;
  clientes: { nome: string } | { nome: string }[] | null;
  parcelas: { valor: number; status: string; tipo: string }[];
};

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; q?: string }>;
}) {
  const params = await searchParams;
  const aba: Aba = params.aba && params.aba in ABAS ? (params.aba as Aba) : "proximos";
  const busca = (params.q ?? "").trim();
  const dia = hoje();

  const supabase = await createClient();
  const eventos = await buscarTodas<Linha>((de, ate) => {
    let q = supabase
      .from("eventos")
      .select("id, titulo, tipo_evento, data_evento, local, status, valor_total, clientes(nome), parcelas(valor, status, tipo)");
    if (aba === "proximos") q = q.gte("data_evento", dia).neq("status", "cancelado");
    if (aba === "orcamentos") q = q.eq("status", "orcamento");
    if (aba === "passados") q = q.lt("data_evento", dia).neq("status", "cancelado");
    if (aba === "cancelados") q = q.eq("status", "cancelado");
    if (busca) q = q.ilike("titulo", `%${busca.replace(/[%_]/g, "")}%`);
    const crescente = aba === "proximos" || aba === "orcamentos";
    return q.order("data_evento", { ascending: crescente }).order("id").range(de, ate);
  });

  return (
    <>
      <Header
        title="Eventos"
        action={
          <Link href="/eventos/novo" className="btn-primario">
            <Plus className="w-4 h-4" />
            Novo evento
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <nav className="flex flex-wrap gap-1.5">
          {(Object.keys(ABAS) as Aba[]).map((a) => (
            <Link
              key={a}
              href={`/eventos?aba=${a}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`}
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
          <input name="q" defaultValue={busca} placeholder="Buscar evento…" className="campo pl-8 py-1.5 w-56" />
        </form>
      </div>

      <div className="cartao">
        {!eventos.length ? (
          <Vazio icone={PartyPopper}>
            {busca ? "Nenhum evento encontrado." : "Nenhum evento aqui ainda."}
          </Vazio>
        ) : (
          <ul className="divide-y divide-black/5 -my-2">
            {eventos.map((e) => {
              const pagamentos = e.parcelas.filter((p) => p.tipo !== "avaria");
              const recebido = pagamentos
                .filter((p) => p.status === "recebido")
                .reduce((s, p) => s + Number(p.valor), 0);
              const cliente = umOuNenhum(e.clientes);
              return (
                <li key={e.id}>
                  <Link
                    href={`/eventos/${e.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-fundo/60 -mx-2 px-2 rounded-lg"
                  >
                    <div className="w-20 shrink-0 text-center">
                      <p className="font-titulo text-2xl leading-none text-oliva-escuro">{e.data_evento.slice(8, 10)}</p>
                      <p className="text-[11px] uppercase tracking-wider text-cinza">
                        {formatarData(e.data_evento).slice(3)}
                      </p>
                    </div>
                    <div className="flex-1 min-w-48">
                      <p className="font-medium">{e.titulo}</p>
                      <p className="text-xs text-cinza">
                        {[cliente?.nome, e.tipo_evento, e.local].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <SeloEvento status={e.status} />
                    <div className="text-right w-36">
                      <p className="valor font-medium">{formatCurrency(e.valor_total)}</p>
                      <p className="text-xs text-cinza valor">recebido {formatCurrency(recebido)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
