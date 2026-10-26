import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BotaoImprimir } from "@/components/documentos/botao-imprimir";
import { Documento, type DadosDocumento } from "@/components/documentos/documento";
import { createClient } from "@/lib/supabase/server";
import { hoje } from "@/lib/datas";
import { isTipoDocumento, TIPOS_DOCUMENTO, type TipoDocumento } from "@/lib/documentos";
import { cn, umOuNenhum } from "@/lib/utils";
import { CATEGORIAS_PECA, type CategoriaPeca, type Parcela } from "@/types";

type ItemComPeca = {
  quantidade: number;
  valor_unitario: number;
  pecas:
    | { nome: string; categoria: CategoriaPeca; valor_reposicao: number | null }
    | { nome: string; categoria: CategoriaPeca; valor_reposicao: number | null }[]
    | null;
};

const ORDEM_CATEGORIA = Object.keys(CATEGORIAS_PECA) as CategoriaPeca[];

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string; tipo: string }>;
}) {
  const { id, tipo } = await params;
  if (!isTipoDocumento(tipo)) notFound();

  const supabase = await createClient();
  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, numero, cliente_id, titulo, status, data_evento, data_saida, data_retorno, local, recebe_pecas, frete, desconto, valor_total, clientes(nome, telefone, email, cpf_cnpj, endereco), evento_itens(quantidade, valor_unitario, pecas(nome, categoria, valor_reposicao)), parcelas(tipo, valor, data_vencimento, status, data_recebimento)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!evento) notFound();

  // Itens na ordem das categorias do acervo e, dentro delas, por nome.
  const itens = ((evento.evento_itens ?? []) as ItemComPeca[])
    .map((i) => ({ ...i, peca: umOuNenhum(i.pecas) }))
    .sort(
      (a, b) =>
        ORDEM_CATEGORIA.indexOf(a.peca?.categoria ?? "outros") -
          ORDEM_CATEGORIA.indexOf(b.peca?.categoria ?? "outros") ||
        (a.peca?.nome ?? "").localeCompare(b.peca?.nome ?? "", "pt-BR")
    )
    .map((i) => ({
      nome: i.peca?.nome ?? "—",
      quantidade: i.quantidade,
      valor_unitario: Number(i.valor_unitario),
      valor_reposicao: i.peca?.valor_reposicao != null ? Number(i.peca.valor_reposicao) : null,
    }));

  const dados: DadosDocumento = {
    evento: {
      numero: Number(evento.numero),
      titulo: evento.titulo,
      data_evento: evento.data_evento,
      data_saida: evento.data_saida,
      data_retorno: evento.data_retorno,
      local: evento.local,
      recebe_pecas: evento.recebe_pecas,
      frete: Number(evento.frete),
      desconto: Number(evento.desconto),
      valor_total: Number(evento.valor_total),
    },
    cliente: umOuNenhum(evento.clientes) as DadosDocumento["cliente"],
    itens,
    parcelas: ((evento.parcelas ?? []) as Parcela[]).map((p) => ({ ...p, valor: Number(p.valor) })),
    emitidoEm: hoje(),
  };

  return (
    <>
      <div className="print:hidden mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/documentos" className="inline-flex items-center gap-1.5 text-sm text-cinza hover:text-oliva">
            <ArrowLeft className="w-4 h-4" /> Documentos
          </Link>
          <BotaoImprimir />
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {(Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[]).map((t) => (
            <Link
              key={t}
              href={`/documentos/${evento.id}/${t}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                t === tipo ? "bg-oliva text-white" : "bg-white border border-black/10 text-cinza hover:border-oliva"
              )}
            >
              {TIPOS_DOCUMENTO[t]}
            </Link>
          ))}
          <Link
            href={`/eventos/${evento.id}`}
            className="px-3 py-1.5 rounded-lg text-sm text-oliva hover:underline"
          >
            Ver o evento
          </Link>
        </nav>
        {tipo !== "orcamento" && evento.status === "orcamento" && (
          <p className="rounded-lg bg-amber-50 text-amber-900 text-sm px-4 py-3 ring-1 ring-amber-200">
            Este evento ainda é <strong>orçamento</strong>: as peças não estão reservadas. Registre o
            primeiro pagamento para confirmar.
          </p>
        )}
        {evento.status === "cancelado" && (
          <p className="rounded-lg bg-red-50 text-red-900 text-sm px-4 py-3 ring-1 ring-red-200">
            Este evento está <strong>cancelado</strong>.
          </p>
        )}
        {tipo !== "orcamento" && (!dados.cliente?.cpf_cnpj || !dados.cliente.endereco) && (
          <p className="text-sm text-cinza">
            O cadastro do cliente está sem CPF/CNPJ ou endereço.{" "}
            <Link href={`/clientes/${evento.cliente_id}/editar`} className="text-oliva underline">
              Complete o cadastro
            </Link>{" "}
            para eles saírem no documento.
          </p>
        )}
      </div>

      <Documento tipo={tipo} dados={dados} />
    </>
  );
}
