import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Pencil, Phone, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ActionButtons } from "@/components/ui/action-buttons";
import { SeloEvento, SeloParcela } from "@/components/ui/selos";
import { ParcelaAcoes } from "@/components/eventos/parcela-acoes";
import { StatusAcoes } from "@/components/eventos/status-acoes";
import { AvariaForm } from "@/components/eventos/avaria-form";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";
import { cn, formatCurrency, umOuNenhum } from "@/lib/utils";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_PECA,
  TIPOS_AVARIA,
  TIPOS_PARCELA,
  type Avaria,
  type CategoriaPeca,
  type Cliente,
  type Despesa,
  type Evento,
  type Parcela,
} from "@/types";

type ItemComPeca = {
  quantidade: number;
  peca_id: string;
  pecas: { id: string; nome: string; categoria: CategoriaPeca; valor_reposicao: number | null } | null;
};

export default async function EventoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [eventoRes, despesasRes] = await Promise.all([
    supabase
      .from("eventos")
      .select(
        "*, clientes(*), evento_itens(quantidade, peca_id, pecas(id, nome, categoria, valor_reposicao)), parcelas(*), avarias(*, pecas(nome))"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("despesas").select("*").eq("evento_id", id).order("data"),
  ]);
  if (!eventoRes.data) notFound();

  const evento = eventoRes.data as Evento;
  const cliente = umOuNenhum(eventoRes.data.clientes) as Cliente | null;
  const itens = ((eventoRes.data.evento_itens ?? []) as unknown as ItemComPeca[])
    .map((i) => ({ ...i, pecas: umOuNenhum(i.pecas) }))
    .sort((a, b) => (a.pecas?.nome ?? "").localeCompare(b.pecas?.nome ?? "", "pt-BR"));
  const parcelas = ((eventoRes.data.parcelas ?? []) as Parcela[]).sort((a, b) =>
    a.data_vencimento.localeCompare(b.data_vencimento)
  );
  const avarias = ((eventoRes.data.avarias ?? []) as (Avaria & { pecas: { nome: string } | null })[]).sort(
    (a, b) => a.data.localeCompare(b.data)
  );
  const despesas = (despesasRes.data ?? []) as Despesa[];

  const pagamentos = parcelas.filter((p) => p.tipo !== "avaria");
  const cobrancasAvaria = parcelas.filter((p) => p.tipo === "avaria");
  const soma = (lista: { valor: number }[]) => lista.reduce((s, p) => s + Number(p.valor), 0);
  const recebido = soma(parcelas.filter((p) => p.status === "recebido"));
  const aReceber = soma(parcelas.filter((p) => p.status !== "recebido"));
  const totalAvarias = soma(cobrancasAvaria);
  const totalDespesas = soma(despesas);
  const faturamento = Number(evento.valor_total) + totalAvarias;
  const resultado = faturamento - totalDespesas;
  const parcelado = soma(pagamentos);
  const diferenca = Math.round((Number(evento.valor_total) - parcelado) * 100) / 100;
  const avariaPorParcela = new Map(avarias.map((a) => [a.id, a]));

  const porCategoria = new Map<CategoriaPeca, ItemComPeca[]>();
  for (const i of itens) {
    const cat = i.pecas?.categoria ?? "outros";
    porCategoria.set(cat, [...(porCategoria.get(cat) ?? []), i]);
  }

  return (
    <>
      <Header
        title={evento.titulo}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <SeloEvento status={evento.status} />
            {evento.tipo_evento && <span>{evento.tipo_evento}</span>}
          </span>
        }
        action={
          <>
            <StatusAcoes eventoId={evento.id} status={evento.status} />
            <Link href={`/eventos/${evento.id}/editar`} className="btn-primario">
              <Pencil className="w-4 h-4" /> Editar
            </Link>
            <ActionButtons
              deleteUrl={`/api/eventos/${evento.id}`}
              deleteConfirmMessage="Excluir este evento com peças, parcelas e avarias? Só é possível se nenhum pagamento foi recebido."
              redirectAfterDelete="/eventos"
            />
          </>
        }
      />

      {evento.status === "orcamento" && (
        <div className="mb-6 rounded-lg bg-amber-50 text-amber-900 text-sm px-4 py-3 ring-1 ring-amber-200">
          <strong>Orçamento:</strong> as peças ainda não estão reservadas. O primeiro pagamento
          registrado confirma o evento — e só é aceito se as peças estiverem livres no período.
        </div>
      )}

      {evento.status === "cancelado" && (
        <div className="mb-6 rounded-lg bg-red-50 text-red-900 text-sm px-4 py-3 ring-1 ring-red-200">
          <strong>Evento cancelado:</strong> as peças estão livres e as parcelas pendentes deste
          evento não entram no &ldquo;a receber&rdquo; do painel. Se alguma ainda for devida (multa,
          por exemplo), mantenha-a; as demais podem ser removidas em Editar.
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Pagamentos */}
          <section className="cartao">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="titulo-secao">Pagamentos</h2>
              {diferenca !== 0 && pagamentos.length > 0 && (
                <p className="text-xs text-amber-700">
                  Parcelas somam {formatCurrency(parcelado)} — {diferenca > 0 ? "faltam" : "passam"}{" "}
                  {formatCurrency(Math.abs(diferenca))} do valor do evento
                </p>
              )}
            </div>
            {!parcelas.length ? (
              <p className="text-sm text-cinza">
                Nenhuma parcela.{" "}
                <Link href={`/eventos/${evento.id}/editar`} className="text-oliva underline">
                  Defina o pagamento
                </Link>
                .
              </p>
            ) : (
              <ul className="divide-y divide-black/5">
                {parcelas.map((p) => {
                  const avaria = p.avaria_id ? avariaPorParcela.get(p.avaria_id) : undefined;
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <SeloParcela parcela={p} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {TIPOS_PARCELA[p.tipo]}
                            {avaria && (
                              <span className="font-normal text-cinza">
                                {" "}— {TIPOS_AVARIA[avaria.tipo].toLowerCase()}: {avaria.quantidade} × {avaria.pecas?.nome}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-cinza">
                            {p.status === "recebido"
                              ? `Recebido em ${formatarData(p.data_recebimento)}`
                              : `Vence em ${formatarData(p.data_vencimento)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="valor font-bold text-oliva-escuro">{formatCurrency(p.valor)}</span>
                        <ParcelaAcoes parcelaId={p.id} recebida={p.status === "recebido"} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Peças */}
          <section className="cartao">
            <h2 className="titulo-secao mb-3">
              Peças <span className="font-normal normal-case tracking-normal">
                — fora do acervo de {formatarData(evento.data_saida)} a {formatarData(evento.data_retorno)}
              </span>
            </h2>
            {!itens.length ? (
              <p className="text-sm text-cinza">Nenhuma peça escolhida ainda.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
                {[...porCategoria.entries()].map(([categoria, lista]) => (
                  <div key={categoria}>
                    <p className="text-xs font-bold text-oliva mb-1">{CATEGORIAS_PECA[categoria]}</p>
                    <ul className="text-sm space-y-1">
                      {lista.map((i) => (
                        <li key={i.peca_id} className="flex justify-between gap-3">
                          <Link href={`/acervo/${i.peca_id}`} className="hover:text-oliva hover:underline">
                            {i.pecas?.nome}
                          </Link>
                          <span className="valor font-bold">{i.quantidade}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Avarias */}
          <section className="cartao space-y-3">
            <h2 className="titulo-secao">Quebras, danos e perdas</h2>
            {avarias.length > 0 && (
              <ul className="divide-y divide-black/5">
                {avarias.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div>
                      <p>
                        <strong>{TIPOS_AVARIA[a.tipo]}</strong> — {a.quantidade} × {a.pecas?.nome}
                      </p>
                      <p className="text-xs text-cinza">
                        {formatarData(a.data)}
                        {a.observacoes ? ` · ${a.observacoes}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="valor">{formatCurrency(a.valor)}</span>
                      <ActionButtons
                        deleteUrl={`/api/avarias/${a.id}`}
                        deleteConfirmMessage="Excluir a avaria? A cobrança some e, se foi quebra/perda, as peças voltam ao acervo."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {itens.length > 0 ? (
              <AvariaForm
                eventoId={evento.id}
                pecas={itens
                  .filter((i) => i.pecas)
                  .map((i) => ({
                    id: i.peca_id,
                    nome: i.pecas!.nome,
                    valor_reposicao: i.pecas!.valor_reposicao,
                    quantidade: i.quantidade,
                  }))}
              />
            ) : (
              <p className="text-sm text-cinza">Escolha as peças do evento para poder registrar avarias.</p>
            )}
          </section>
        </div>

        {/* Lateral */}
        <div className="space-y-6">
          <section className="cartao space-y-2 text-sm">
            <h2 className="titulo-secao mb-1">Detalhes</h2>
            <p className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-cinza" /> {formatarData(evento.data_evento)}
            </p>
            {evento.local && (
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cinza" /> {evento.local}
              </p>
            )}
            {evento.convidados && (
              <p className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cinza" /> {evento.convidados} convidados
              </p>
            )}
            {cliente && (
              <div className="pt-2 border-t border-black/5">
                <p className="font-medium">{cliente.nome}</p>
                {cliente.telefone && (
                  <p className="flex items-center gap-2 text-cinza">
                    <Phone className="w-3.5 h-3.5" /> {cliente.telefone}
                  </p>
                )}
                {cliente.email && <p className="text-cinza">{cliente.email}</p>}
              </div>
            )}
            {evento.observacoes && (
              <p className="pt-2 border-t border-black/5 whitespace-pre-line text-cinza">{evento.observacoes}</p>
            )}
          </section>

          <section className="cartao text-sm">
            <h2 className="titulo-secao mb-3">Resultado do evento</h2>
            <dl className="space-y-1.5">
              <Linha rotulo="Valor do evento" valor={Number(evento.valor_total)} />
              {totalAvarias > 0 && <Linha rotulo="+ Cobranças de avaria" valor={totalAvarias} />}
              {totalDespesas > 0 && <Linha rotulo="− Despesas do evento" valor={-totalDespesas} />}
              <div className="border-t border-black/10 pt-1.5">
                <Linha rotulo="Resultado" valor={resultado} destaque />
              </div>
              <div className="pt-3 space-y-1.5">
                <Linha rotulo="Recebido" valor={recebido} />
                <Linha rotulo="A receber" valor={aReceber} />
              </div>
            </dl>
          </section>

          <section className="cartao text-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="titulo-secao">Despesas do evento</h2>
              <Link href={`/despesas/nova?evento=${evento.id}`} className="text-xs text-oliva hover:underline">
                + Lançar
              </Link>
            </div>
            {!despesas.length ? (
              <p className="text-cinza">Frete e outros custos lançados com este evento aparecem aqui.</p>
            ) : (
              <ul className="space-y-1.5">
                {despesas.map((d) => (
                  <li key={d.id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {d.descricao} <span className="text-cinza">· {CATEGORIAS_DESPESA[d.categoria]}</span>
                    </span>
                    <span className="valor shrink-0">{formatCurrency(d.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, destaque = false }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={cn(destaque ? "font-bold" : "text-cinza")}>{rotulo}</dt>
      <dd
        className={cn(
          "valor",
          destaque && "font-bold",
          destaque && (valor >= 0 ? "text-oliva" : "text-red-600")
        )}
      >
        {formatCurrency(valor)}
      </dd>
    </div>
  );
}
