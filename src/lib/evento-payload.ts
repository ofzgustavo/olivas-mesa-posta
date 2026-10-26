// Validação do que chega do formulário de evento antes de ir para o
// banco. O banco tem as mesmas regras como CHECK; aqui elas viram
// mensagens claras em vez de erro técnico.

import { data, inteiro, numero, texto, uuid } from "@/lib/api";
import type { TipoParcela } from "@/types";

const TIPOS_EDITAVEIS: TipoParcela[] = ["sinal", "saldo", "parcela", "avista"];

export type PayloadEvento = {
  dados: Record<string, unknown>;
  itens: { peca_id: string; quantidade: number; valor_unitario: number }[];
  parcelas: { id?: string; tipo: TipoParcela; valor: number; data_vencimento: string }[];
};

export function lerEvento(
  corpo: Record<string, unknown>
): { ok: true; payload: PayloadEvento } | { ok: false; erro: string } {
  const falha = (erro: string) => ({ ok: false as const, erro });

  const cliente_id = uuid(corpo["cliente_id"]);
  const titulo = texto(corpo["titulo"]);
  const data_evento = data(corpo["data_evento"]);
  const data_saida = data(corpo["data_saida"]);
  const data_retorno = data(corpo["data_retorno"]);
  const valor_total = numero(corpo["valor_total"]) ?? 0;
  const frete = numero(corpo["frete"]) ?? 0;
  const desconto = numero(corpo["desconto"]) ?? 0;
  const convidadosBruto = corpo["convidados"];
  const convidados = convidadosBruto == null || convidadosBruto === "" ? null : inteiro(convidadosBruto);

  if (!cliente_id) return falha("Selecione o cliente.");
  if (!titulo) return falha("Dê um nome ao evento (ex.: Casamento Ana e João).");
  if (!data_evento) return falha("Informe a data do evento.");
  if (!data_saida || !data_retorno) return falha("Informe as datas de saída e de retorno das peças.");
  if (data_saida > data_evento) return falha("A saída das peças não pode ser depois do evento.");
  if (data_retorno < data_evento) return falha("O retorno das peças não pode ser antes do evento.");
  if (valor_total < 0) return falha("Valor do evento inválido.");
  if (frete < 0) return falha("Frete inválido.");
  if (desconto < 0) return falha("Desconto inválido.");
  if (convidados === null && convidadosBruto != null && convidadosBruto !== "") {
    return falha("Número de convidados inválido.");
  }
  if (convidados != null && convidados <= 0) return falha("Número de convidados inválido.");

  const itensBrutos = Array.isArray(corpo["itens"]) ? (corpo["itens"] as unknown[]) : [];
  const itens: PayloadEvento["itens"] = [];
  const vistas = new Set<string>();
  for (const bruto of itensBrutos) {
    const item = (bruto ?? {}) as Record<string, unknown>;
    const peca_id = uuid(item["peca_id"]);
    const quantidade = inteiro(item["quantidade"]);
    const valorBruto = item["valor_unitario"];
    const valor_unitario = valorBruto == null || valorBruto === "" ? 0 : numero(valorBruto);
    if (!peca_id || quantidade == null || quantidade <= 0) {
      return falha("Toda peça escolhida precisa de uma quantidade maior que zero.");
    }
    if (valor_unitario == null || valor_unitario < 0) return falha("Preço de peça inválido.");
    if (vistas.has(peca_id)) return falha("A mesma peça foi adicionada duas vezes.");
    vistas.add(peca_id);
    itens.push({ peca_id, quantidade, valor_unitario: Math.round(valor_unitario * 100) / 100 });
  }

  const parcelasBrutas = Array.isArray(corpo["parcelas"]) ? (corpo["parcelas"] as unknown[]) : [];
  const parcelas: PayloadEvento["parcelas"] = [];
  for (const bruto of parcelasBrutas) {
    const p = (bruto ?? {}) as Record<string, unknown>;
    const tipo = p["tipo"] as TipoParcela;
    const valor = numero(p["valor"]);
    const venc = data(p["data_vencimento"]);
    const id = p["id"] == null ? undefined : uuid(p["id"]);
    if (!TIPOS_EDITAVEIS.includes(tipo)) return falha("Tipo de parcela inválido.");
    if (valor == null || valor <= 0) return falha("Toda parcela precisa de um valor maior que zero.");
    if (!venc) return falha("Toda parcela precisa de uma data de vencimento.");
    if (id === null) return falha("Parcela inválida.");
    parcelas.push({ ...(id ? { id } : {}), tipo, valor: Math.round(valor * 100) / 100, data_vencimento: venc });
  }

  return {
    ok: true,
    payload: {
      dados: {
        cliente_id,
        titulo,
        tipo_evento: texto(corpo["tipo_evento"]),
        data_evento,
        data_saida,
        data_retorno,
        local: texto(corpo["local"]),
        recebe_pecas: texto(corpo["recebe_pecas"]),
        convidados,
        frete: Math.round(frete * 100) / 100,
        desconto: Math.round(desconto * 100) / 100,
        valor_total: Math.round(valor_total * 100) / 100,
        observacoes: texto(corpo["observacoes"]),
      },
      itens,
      parcelas,
    },
  };
}
