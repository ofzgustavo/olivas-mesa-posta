"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Search, Trash2, UserPlus, Wand2 } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import { cn, formatCurrency, parseValor } from "@/lib/utils";
import { formatarData, hoje, isDataISO, somarDias } from "@/lib/datas";
import { gerarParcelas, somaParcelas, type Condicao } from "@/lib/parcelas";
import { somaItens, valorSugerido } from "@/lib/documentos";
import type { PecaComDisponibilidade } from "@/lib/acervo";
import {
  CATEGORIAS_PECA,
  DIAS_RETORNO_PADRAO,
  TIPOS_PARCELA,
  type CategoriaPeca,
  type Cliente,
  type Evento,
  type Parcela,
  type TipoParcela,
} from "@/types";

type EventoCompleto = Evento & {
  evento_itens: { peca_id: string; quantidade: number; valor_unitario: number }[];
  parcelas: Parcela[];
};

interface LinhaParcela {
  chave: number;
  id?: string;
  tipo: TipoParcela;
  valor: string;
  data_vencimento: string;
  recebida: boolean;
  data_recebimento?: string | null;
}

const TIPOS_EDITAVEIS: TipoParcela[] = ["sinal", "saldo", "parcela", "avista"];

let proximaChave = 1;
const novaChave = () => proximaChave++;

function valorParaCampo(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

// Campo de dinheiro opcional: vazio vale zero.
function valorOuZero(texto: string | undefined): number {
  return texto?.trim() ? parseValor(texto) : 0;
}

export function EventoForm({
  clientes: clientesIniciais,
  evento,
}: {
  clientes: Pick<Cliente, "id" | "nome">[];
  evento?: EventoCompleto;
}) {
  const router = useRouter();
  const notificar = useToast();
  const editando = evento != null;

  // ---- dados do evento ----
  const [clientes, setClientes] = useState(clientesIniciais);
  const [clienteId, setClienteId] = useState(evento?.cliente_id ?? "");
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [tipoEvento, setTipoEvento] = useState(evento?.tipo_evento ?? "");
  const [dataEvento, setDataEvento] = useState(evento?.data_evento ?? "");
  const [dataSaida, setDataSaida] = useState(evento?.data_saida ?? "");
  const [dataRetorno, setDataRetorno] = useState(evento?.data_retorno ?? "");
  // Enquanto a usuária não mexer nas datas de saída/retorno, elas
  // acompanham a data do evento (sai no dia, volta 3 dias depois).
  const [datasManuais, setDatasManuais] = useState(editando);
  const [local, setLocal] = useState(evento?.local ?? "");
  const [recebePecas, setRecebePecas] = useState(evento?.recebe_pecas ?? "");
  const [convidados, setConvidados] = useState(evento?.convidados ? String(evento.convidados) : "");
  const [observacoes, setObservacoes] = useState(evento?.observacoes ?? "");

  // ---- novo cliente rápido ----
  const [criandoCliente, setCriandoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");

  // ---- peças ----
  const [itens, setItens] = useState<Record<string, string>>(() =>
    Object.fromEntries((evento?.evento_itens ?? []).map((i) => [i.peca_id, String(i.quantidade)]))
  );
  // Preço de uma unidade neste evento. Ao escolher a peça, vem o preço de
  // locação do acervo; pode ser mudado só para este evento.
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (evento?.evento_itens ?? [])
        .filter((i) => Number(i.valor_unitario) > 0)
        .map((i) => [i.peca_id, valorParaCampo(Number(i.valor_unitario))])
    )
  );
  const [acervo, setAcervo] = useState<PecaComDisponibilidade[] | null>(null);
  const [erroAcervo, setErroAcervo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [soEscolhidas, setSoEscolhidas] = useState(editando);

  // ---- pagamento ----
  const [frete, setFrete] = useState(evento && Number(evento.frete) > 0 ? valorParaCampo(Number(evento.frete)) : "");
  const [desconto, setDesconto] = useState(
    evento && Number(evento.desconto) > 0 ? valorParaCampo(Number(evento.desconto)) : ""
  );
  const [valorTotal, setValorTotal] = useState(evento ? valorParaCampo(Number(evento.valor_total)) : "");
  // Num evento novo, o valor acompanha itens + frete − desconto até a
  // usuária digitar outro (montagem, por exemplo).
  const [valorManual, setValorManual] = useState(editando);
  const [parcelas, setParcelas] = useState<LinhaParcela[]>(() =>
    (evento?.parcelas ?? [])
      .filter((p) => p.tipo !== "avaria")
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
      .map((p) => ({
        chave: novaChave(),
        id: p.id,
        tipo: p.tipo,
        valor: valorParaCampo(Number(p.valor)),
        data_vencimento: p.data_vencimento,
        recebida: p.status === "recebido",
        data_recebimento: p.data_recebimento,
      }))
  );
  const [forma, setForma] = useState<Condicao["forma"]>("sinal_saldo");
  const [percentualSinal, setPercentualSinal] = useState("50");
  const [vencSinal, setVencSinal] = useState(hoje());
  const [vencSaldo, setVencSaldo] = useState("");
  const [vezes, setVezes] = useState("3");
  const [primeiroVenc, setPrimeiroVenc] = useState(hoje());

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function mudarDataEvento(valor: string) {
    setDataEvento(valor);
    if (!datasManuais && isDataISO(valor)) {
      setDataSaida(valor);
      setDataRetorno(somarDias(valor, DIAS_RETORNO_PADRAO));
    }
    if (isDataISO(valor) && !vencSaldo) setVencSaldo(valor);
  }

  // Disponibilidade das peças no período em que elas ficam fora.
  const periodoValido = isDataISO(dataSaida) && isDataISO(dataRetorno) && dataSaida <= dataRetorno;
  useEffect(() => {
    if (!periodoValido) {
      setAcervo(null);
      return;
    }
    let cancelado = false;
    const params = new URLSearchParams({ inicio: dataSaida, fim: dataRetorno });
    if (evento) params.set("ignorar", evento.id);
    requisitar<PecaComDisponibilidade[]>(`/api/acervo?${params}`, "GET").then((r) => {
      if (cancelado) return;
      if (r.ok) {
        setAcervo(r.dados);
        setErroAcervo(null);
      } else {
        setErroAcervo(r.erro);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [periodoValido, dataSaida, dataRetorno, evento]);

  const escolhidas = useMemo(
    () => Object.entries(itens).filter(([, q]) => Number(q) > 0),
    [itens]
  );

  const pecasVisiveis = useMemo(() => {
    if (!acervo) return [];
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return acervo.filter((p) => {
      const escolhida = Number(itens[p.id]) > 0;
      if (!p.ativo && !escolhida) return false;
      if (soEscolhidas && !escolhida) return false;
      if (termo && !p.nome.toLocaleLowerCase("pt-BR").includes(termo)) return false;
      return true;
    });
  }, [acervo, busca, itens, soEscolhidas]);

  const porCategoria = useMemo(() => {
    const mapa = new Map<CategoriaPeca, PecaComDisponibilidade[]>();
    for (const p of pecasVisiveis) mapa.set(p.categoria, [...(mapa.get(p.categoria) ?? []), p]);
    return [...mapa.entries()];
  }, [pecasVisiveis]);

  function mudarQuantidade(peca: PecaComDisponibilidade, quantidade: string) {
    setItens((atuais) => ({ ...atuais, [peca.id]: quantidade }));
    if (Number(quantidade) > 0 && !precos[peca.id]?.trim() && peca.valor_locacao != null) {
      setPrecos((atuais) => ({ ...atuais, [peca.id]: valorParaCampo(Number(peca.valor_locacao)) }));
    }
  }

  const faltas = useMemo(() => {
    if (!acervo) return [];
    return acervo
      .filter((p) => Number(itens[p.id]) > Math.max(p.disponivel, 0))
      .map((p) => ({ nome: p.nome, pedido: Number(itens[p.id]), livre: Math.max(p.disponivel, 0) }));
  }, [acervo, itens]);

  // ---- valor: itens + frete − desconto ----
  const valorFrete = valorOuZero(frete);
  const valorDesconto = valorOuZero(desconto);
  const itensComPreco = escolhidas.map(([peca_id, q]) => ({
    peca_id,
    quantidade: Number(q),
    valor_unitario: valorOuZero(precos[peca_id]),
  }));
  const precosValidos = itensComPreco.every((i) => Number.isFinite(i.valor_unitario) && i.valor_unitario >= 0);
  const extrasValidos = [valorFrete, valorDesconto].every((v) => Number.isFinite(v) && v >= 0);
  const subtotalItens = precosValidos ? somaItens(itensComPreco) : NaN;
  const sugerido = precosValidos && extrasValidos ? valorSugerido(itensComPreco, valorFrete, valorDesconto) : NaN;
  const valorTotalCampo = valorManual ? valorTotal : sugerido > 0 ? valorParaCampo(sugerido) : "";

  // ---- pagamento: contas ----
  const total = parseValor(valorTotalCampo);
  const totalValido = Number.isFinite(total) && total >= 0;
  const valoresParcelas = parcelas.map((p) => parseValor(p.valor));
  const parcelasValidas = valoresParcelas.every((v) => Number.isFinite(v) && v > 0);
  const somaAtual = parcelasValidas
    ? somaParcelas(valoresParcelas.map((valor) => ({ valor })))
    : NaN;
  const recebido = somaParcelas(
    parcelas.filter((p) => p.recebida).map((p) => ({ valor: parseValor(p.valor) }))
  );
  const diferenca = totalValido && Number.isFinite(somaAtual) ? Math.round((total - somaAtual) * 100) / 100 : 0;

  function gerar() {
    if (!totalValido || total <= 0) {
      setErro("Informe o valor do evento antes de gerar as parcelas.");
      return;
    }
    const restante = Math.round((total - recebido) * 100) / 100;
    if (restante <= 0) {
      setErro("O valor do evento já está todo recebido.");
      return;
    }
    let condicao: Condicao;
    if (forma === "avista") {
      if (!isDataISO(vencSinal)) return setErro("Informe o vencimento do pagamento à vista.");
      condicao = { forma, vencimento: vencSinal };
    } else if (forma === "sinal_saldo") {
      const pct = Number(percentualSinal.replace(",", "."));
      if (!(pct > 0 && pct <= 100)) return setErro("Percentual do sinal deve estar entre 1 e 100.");
      if (!isDataISO(vencSinal) || !isDataISO(vencSaldo)) {
        return setErro("Informe os vencimentos do sinal e do saldo.");
      }
      condicao = { forma, percentualSinal: pct, vencimentoSinal: vencSinal, vencimentoSaldo: vencSaldo };
    } else {
      const n = Number(vezes);
      if (!(Number.isInteger(n) && n >= 1 && n <= 36)) return setErro("Número de parcelas inválido.");
      if (!isDataISO(primeiroVenc)) return setErro("Informe o primeiro vencimento.");
      condicao = { forma, vezes: n, primeiroVencimento: primeiroVenc };
    }
    setErro(null);
    // Recebidas ficam; as pendentes são substituídas pela nova condição.
    const geradas = gerarParcelas(restante, condicao).map((p) => ({
      chave: novaChave(),
      tipo: p.tipo,
      valor: valorParaCampo(p.valor),
      data_vencimento: p.data_vencimento,
      recebida: false,
    }));
    setParcelas((atuais) => [...atuais.filter((p) => p.recebida), ...geradas]);
  }

  function atualizarParcela(chave: number, campo: "tipo" | "valor" | "data_vencimento", valor: string) {
    setParcelas((atuais) =>
      atuais.map((p) => (p.chave === chave ? { ...p, [campo]: valor } : p))
    );
  }

  async function criarCliente() {
    if (!novoClienteNome.trim()) return;
    const r = await requisitar<Cliente>("/api/clientes", "POST", {
      nome: novoClienteNome,
      telefone: novoClienteTelefone,
    });
    if (!r.ok) {
      notificar("erro", r.erro);
      return;
    }
    setClientes((atuais) =>
      [...atuais, { id: r.dados.id, nome: r.dados.nome }].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    );
    setClienteId(r.dados.id);
    setCriandoCliente(false);
    setNovoClienteNome("");
    setNovoClienteTelefone("");
    notificar("sucesso", "Cliente cadastrado.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!precosValidos) return setErro("Confira os preços das peças.");
    if (!extrasValidos) return setErro("Confira o frete e o desconto.");
    if (!totalValido) return setErro("Valor do evento inválido.");
    if (!parcelasValidas) return setErro("Confira os valores das parcelas.");
    if (parcelas.some((p) => !isDataISO(p.data_vencimento))) {
      return setErro("Toda parcela precisa de uma data de vencimento.");
    }
    const quantidadesInvalidas = Object.values(itens).some(
      (q) => q.trim() !== "" && !(Number.isInteger(Number(q)) && Number(q) >= 0)
    );
    if (quantidadesInvalidas) return setErro("As quantidades de peças devem ser números inteiros.");

    setSalvando(true);
    const corpo = {
      cliente_id: clienteId,
      titulo,
      tipo_evento: tipoEvento,
      data_evento: dataEvento,
      data_saida: dataSaida,
      data_retorno: dataRetorno,
      local,
      recebe_pecas: recebePecas,
      convidados,
      frete: valorFrete,
      desconto: valorDesconto,
      valor_total: total,
      observacoes,
      itens: itensComPreco,
      parcelas: parcelas.map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        tipo: p.tipo,
        valor: parseValor(p.valor),
        data_vencimento: p.data_vencimento,
      })),
    };

    const r = editando
      ? await requisitar<{ id: string }>(`/api/eventos/${evento.id}`, "PUT", corpo)
      : await requisitar<{ id: string }>("/api/eventos", "POST", corpo);

    if (!r.ok) {
      setErro(r.erro);
      setSalvando(false);
      return;
    }
    notificar("sucesso", editando ? "Evento atualizado." : "Evento cadastrado.");
    router.push(`/eventos/${r.dados.id}`);
    router.refresh();
  }

  const reservaAtiva = evento && (evento.status === "confirmado" || evento.status === "realizado");

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* ----- Dados ----- */}
      <section className="cartao space-y-4">
        <h2 className="titulo-secao">Evento</h2>

        <div>
          <label className="rotulo" htmlFor="cliente">Cliente *</label>
          {!criandoCliente ? (
            <div className="flex gap-2">
              <select
                id="cliente"
                required
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className="campo"
              >
                <option value="" disabled>Selecione</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button type="button" onClick={() => setCriandoCliente(true)} className="btn-contorno shrink-0">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Novo</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-fundo">
              <input
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
                placeholder="Nome do cliente"
                className="campo flex-1 min-w-48"
                autoFocus
              />
              <input
                value={novoClienteTelefone}
                onChange={(e) => setNovoClienteTelefone(e.target.value)}
                placeholder="Telefone"
                className="campo w-40"
              />
              <button type="button" onClick={criarCliente} className="btn-primario">Cadastrar</button>
              <button type="button" onClick={() => setCriandoCliente(false)} className="btn-contorno">
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="titulo">Nome do evento *</label>
            <input
              id="titulo"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="campo"
              placeholder="Ex.: Casamento Ana e João"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="tipo">Tipo</label>
            <input
              id="tipo"
              list="tipos-evento"
              value={tipoEvento}
              onChange={(e) => setTipoEvento(e.target.value)}
              className="campo"
              placeholder="Casamento, aniversário…"
            />
            <datalist id="tipos-evento">
              {["Casamento", "Aniversário", "Batizado", "Chá de bebê", "Chá de panela", "Noivado",
                "Jantar", "Almoço", "Corporativo", "Formatura"].map((t) => <option key={t} value={t} />)}
            </datalist>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="rotulo" htmlFor="data-evento">Data do evento *</label>
            <DateInput id="data-evento" value={dataEvento} onChange={mudarDataEvento} required />
          </div>
          <div>
            <label className="rotulo" htmlFor="data-saida">Peças saem em *</label>
            <DateInput
              id="data-saida"
              value={dataSaida}
              onChange={(v) => {
                setDatasManuais(true);
                setDataSaida(v);
              }}
              required
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="data-retorno">Peças livres de novo em *</label>
            <DateInput
              id="data-retorno"
              value={dataRetorno}
              onChange={(v) => {
                setDatasManuais(true);
                setDataRetorno(v);
              }}
              required
            />
          </div>
        </div>
        <p className="text-xs text-cinza -mt-2">
          As peças ficam reservadas da saída ao retorno (inclui retorno e lavagem). Padrão: saem no
          dia do evento e voltam {DIAS_RETORNO_PADRAO} dias depois.
        </p>

        <div className="grid sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="rotulo" htmlFor="local">Local de entrega</label>
            <input id="local" value={local} onChange={(e) => setLocal(e.target.value)} className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="recebe-pecas">Quem recebe as peças</label>
            <input
              id="recebe-pecas"
              value={recebePecas}
              onChange={(e) => setRecebePecas(e.target.value)}
              className="campo"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="convidados">Convidados</label>
            <input
              id="convidados"
              type="number"
              min={1}
              value={convidados}
              onChange={(e) => setConvidados(e.target.value)}
              className="campo"
            />
          </div>
        </div>

        <div>
          <label className="rotulo" htmlFor="observacoes">Observações</label>
          <textarea
            id="observacoes"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="campo resize-none"
            placeholder="Paleta de cores, horário de montagem, contato no local…"
          />
        </div>
      </section>

      {/* ----- Peças ----- */}
      <section className="cartao space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="titulo-secao">
            Peças {escolhidas.length > 0 && <span className="text-oliva">({escolhidas.length} escolhidas)</span>}
          </h2>
          {periodoValido && (
            <p className="text-xs text-cinza">
              Livre entre {formatarData(dataSaida)} e {formatarData(dataRetorno)}
            </p>
          )}
        </div>

        {!periodoValido ? (
          <p className="text-sm text-cinza">Informe as datas acima para ver o que está livre no acervo.</p>
        ) : erroAcervo ? (
          <p className="text-sm text-red-600">{erroAcervo}</p>
        ) : !acervo ? (
          <p className="text-sm text-cinza">Carregando acervo…</p>
        ) : acervo.length === 0 ? (
          <p className="text-sm text-cinza">
            O acervo está vazio. Cadastre as peças em <Link href="/acervo/novo" className="underline">Acervo</Link>.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="w-3.5 h-3.5 text-cinza absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar peça…"
                  className="campo pl-8"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-cinza">
                <input
                  type="checkbox"
                  checked={soEscolhidas}
                  onChange={(e) => setSoEscolhidas(e.target.checked)}
                  className="rounded border-gray-300 text-oliva"
                />
                Só as escolhidas
              </label>
            </div>

            {faltas.length > 0 && (
              <div className="flex gap-2 p-3 rounded-lg bg-amber-50 text-amber-900 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Peças além do que está livre no período:</p>
                  <p>{faltas.map((f) => `${f.nome} (pedido ${f.pedido}, livre ${f.livre})`).join("; ")}</p>
                  <p className="mt-1 text-xs">
                    {reservaAtiva
                      ? "Este evento já está confirmado: o sistema não vai deixar salvar assim."
                      : "Dá para salvar como orçamento, mas o pagamento só será aceito quando houver peças livres."}
                  </p>
                </div>
              </div>
            )}

            {porCategoria.length === 0 ? (
              <p className="text-sm text-cinza">Nenhuma peça encontrada.</p>
            ) : (
              <div className="space-y-4">
                {porCategoria.map(([categoria, lista]) => (
                  <div key={categoria}>
                    <p className="text-xs font-bold text-oliva mb-1">{CATEGORIAS_PECA[categoria]}</p>
                    <ul className="divide-y divide-black/5 border-y border-black/5">
                      {lista.map((p) => {
                        const qtd = Number(itens[p.id]) || 0;
                        const excede = qtd > Math.max(p.disponivel, 0);
                        const preco = valorOuZero(precos[p.id]);
                        return (
                          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                            <div className="flex-1 min-w-40">
                              <p className={cn("text-sm truncate", qtd > 0 && "font-bold")}>{p.nome}</p>
                              <p className="text-xs text-cinza">
                                {Math.max(p.disponivel, 0)} livres de {p.estoque}
                                {!p.ativo && " · peça desativada"}
                                {qtd > 0 && preco > 0 && (
                                  <span className="valor text-oliva">
                                    {" "}· {qtd} × {formatCurrency(preco)} = {formatCurrency(qtd * preco)}
                                  </span>
                                )}
                              </p>
                            </div>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="numeric"
                              aria-label={`Quantidade de ${p.nome}`}
                              value={itens[p.id] ?? ""}
                              onChange={(e) => mudarQuantidade(p, e.target.value)}
                              className={cn("campo w-24 text-right", excede && "ring-2 ring-amber-400")}
                              placeholder="0"
                            />
                            {qtd > 0 ? (
                              <div className="relative w-28" title="Preço por unidade">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-cinza">
                                  R$/un.
                                </span>
                                <input
                                  inputMode="decimal"
                                  aria-label={`Preço por unidade de ${p.nome}`}
                                  value={precos[p.id] ?? ""}
                                  onChange={(e) => setPrecos((atuais) => ({ ...atuais, [p.id]: e.target.value }))}
                                  className="campo pl-12 text-right"
                                  placeholder="0,00"
                                />
                              </div>
                            ) : (
                              // guarda o lugar do preço para as quantidades ficarem alinhadas
                              <span className="w-28 hidden sm:block" aria-hidden="true" />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* ----- Valor e pagamento ----- */}
      <section className="cartao space-y-4">
        <h2 className="titulo-secao">Valor e pagamento</h2>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="rotulo" htmlFor="frete">Frete cobrado (R$)</label>
            <input
              id="frete"
              inputMode="decimal"
              value={frete}
              onChange={(e) => setFrete(e.target.value)}
              className="campo"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="desconto">Desconto (R$)</label>
            <input
              id="desconto"
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              className="campo"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="valor-total">Valor do evento (R$) *</label>
            <input
              id="valor-total"
              inputMode="decimal"
              required
              value={valorTotalCampo}
              onChange={(e) => {
                setValorManual(true);
                setValorTotal(e.target.value);
              }}
              className="campo text-lg"
              placeholder="0,00"
            />
          </div>
        </div>
        {subtotalItens > 0 && Number.isFinite(sugerido) && (
          <p className="text-xs text-cinza -mt-2">
            Peças {formatCurrency(subtotalItens)}
            {valorFrete > 0 && <> + frete {formatCurrency(valorFrete)}</>}
            {valorDesconto > 0 && <> − desconto {formatCurrency(valorDesconto)}</>}
            {" "}= <strong className="valor">{formatCurrency(sugerido)}</strong>.
            {totalValido && Math.abs(total - sugerido) >= 0.01 && (
              <>
                {" "}O valor do evento está diferente: a diferença sai nos documentos como{" "}
                {total > sugerido ? "montagem e serviços" : "desconto adicional"}.{" "}
                <button
                  type="button"
                  onClick={() => setValorManual(false)}
                  className="text-oliva underline"
                >
                  Usar {formatCurrency(sugerido)}
                </button>
              </>
            )}
          </p>
        )}
        {!(subtotalItens > 0) && (
          <p className="text-xs text-cinza -mt-2">
            Locação + montagem, combinado com o cliente. Com o preço de cada peça preenchido, o
            valor é somado sozinho.
          </p>
        )}

        <div className="rounded-lg bg-fundo p-4 space-y-3">
          <p className="text-sm font-bold text-oliva-escuro flex items-center gap-1.5">
            <Wand2 className="w-4 h-4" /> Gerar parcelas
            {recebido > 0 && (
              <span className="font-normal text-cinza">
                {" "}— sobre o que falta receber ({formatCurrency(Math.max(total - recebido, 0))})
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              ["sinal_saldo", "Sinal + saldo"],
              ["parcelado", "Parcelado"],
              ["avista", "À vista"],
            ] as const).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setForma(valor)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  forma === valor ? "bg-oliva text-white border-oliva" : "bg-white border-black/10 text-cinza hover:border-oliva"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {forma === "sinal_saldo" && (
              <>
                <div>
                  <label className="rotulo" htmlFor="pct-sinal">Sinal (%)</label>
                  <input
                    id="pct-sinal"
                    inputMode="decimal"
                    value={percentualSinal}
                    onChange={(e) => setPercentualSinal(e.target.value)}
                    className="campo w-20"
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="venc-sinal">Vencimento do sinal</label>
                  <DateInput id="venc-sinal" value={vencSinal} onChange={setVencSinal} className="w-36" />
                </div>
                <div>
                  <label className="rotulo" htmlFor="venc-saldo">Vencimento do saldo</label>
                  <DateInput id="venc-saldo" value={vencSaldo} onChange={setVencSaldo} className="w-36" />
                </div>
              </>
            )}
            {forma === "parcelado" && (
              <>
                <div>
                  <label className="rotulo" htmlFor="vezes">Parcelas</label>
                  <input
                    id="vezes"
                    type="number"
                    min={1}
                    max={36}
                    value={vezes}
                    onChange={(e) => setVezes(e.target.value)}
                    className="campo w-20"
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="primeiro-venc">1º vencimento (depois, mensal)</label>
                  <DateInput id="primeiro-venc" value={primeiroVenc} onChange={setPrimeiroVenc} className="w-36" />
                </div>
              </>
            )}
            {forma === "avista" && (
              <div>
                <label className="rotulo" htmlFor="venc-avista">Vencimento</label>
                <DateInput id="venc-avista" value={vencSinal} onChange={setVencSinal} className="w-36" />
              </div>
            )}
            <button type="button" onClick={gerar} className="btn-contorno bg-white">
              Gerar
            </button>
          </div>
        </div>

        {parcelas.length > 0 && (
          <ul className="space-y-2">
            {parcelas.map((p) =>
              p.recebida ? (
                <li key={p.chave} className="flex flex-wrap items-center gap-3 text-sm px-1 py-1.5">
                  <span className="selo bg-emerald-50 text-emerald-800">Recebida</span>
                  <span>{TIPOS_PARCELA[p.tipo]}</span>
                  <span className="valor font-bold">{formatCurrency(parseValor(p.valor))}</span>
                  <span className="text-cinza">em {formatarData(p.data_recebimento)}</span>
                </li>
              ) : (
                <li key={p.chave} className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Tipo da parcela"
                    value={p.tipo}
                    onChange={(e) => atualizarParcela(p.chave, "tipo", e.target.value)}
                    className="campo w-32"
                  >
                    {TIPOS_EDITAVEIS.map((t) => (
                      <option key={t} value={t}>{TIPOS_PARCELA[t]}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Valor da parcela"
                    inputMode="decimal"
                    value={p.valor}
                    onChange={(e) => atualizarParcela(p.chave, "valor", e.target.value)}
                    className="campo w-32"
                    placeholder="0,00"
                  />
                  <DateInput
                    value={p.data_vencimento}
                    onChange={(v) => atualizarParcela(p.chave, "data_vencimento", v)}
                    className="w-36"
                  />
                  <button
                    type="button"
                    onClick={() => setParcelas((atuais) => atuais.filter((x) => x.chave !== p.chave))}
                    className="p-2 text-cinza hover:text-red-600 hover:bg-red-50 rounded-lg"
                    aria-label="Remover parcela"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              )
            )}
          </ul>
        )}

        <button
          type="button"
          onClick={() =>
            setParcelas((atuais) => [
              ...atuais,
              { chave: novaChave(), tipo: "parcela", valor: "", data_vencimento: "", recebida: false },
            ])
          }
          className="text-sm text-oliva hover:underline flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Adicionar parcela manualmente
        </button>

        {parcelas.length > 0 && totalValido && Number.isFinite(somaAtual) && (
          <p
            className={cn(
              "text-sm",
              diferenca === 0 ? "text-oliva" : "text-amber-700"
            )}
          >
            Parcelas: {formatCurrency(somaAtual)} de {formatCurrency(total)}
            {diferenca > 0 && ` — faltam ${formatCurrency(diferenca)}`}
            {diferenca < 0 && ` — passam ${formatCurrency(-diferenca)} do valor do evento`}
          </p>
        )}
      </section>

      {erro && (
        <p className="text-red-600 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {erro}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={salvando} className="btn-primario">
          {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar evento"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-contorno">
          Cancelar
        </button>
      </div>
    </form>
  );
}
