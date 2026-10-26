// Contas e textos dos documentos impressos de um evento: orçamento,
// contrato e recibo de entrega. Puro (sem banco nem React) para ser
// testado direto no `node --test`.

import { diferencaEmDias, formatarData } from "./datas.ts";
import type { TipoParcela } from "../types/index.ts";

export const TIPOS_DOCUMENTO = {
  orcamento: "Orçamento",
  contrato: "Contrato",
  recibo: "Recibo de entrega",
} as const;
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export function isTipoDocumento(valor: unknown): valor is TipoDocumento {
  return typeof valor === "string" && valor in TIPOS_DOCUMENTO;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (valor: number) => BRL.format(valor);
const centavos = (valor: number) => Math.round(valor * 100) / 100;

/** Número impresso no documento: 7 → "0007". */
export function numeroDocumento(numero: number): string {
  return String(numero).padStart(4, "0");
}

/** Preço sugerido para o evento: itens + frete − desconto (nunca negativo). */
export function valorSugerido(
  itens: { quantidade: number; valor_unitario: number }[],
  frete: number,
  desconto: number
): number {
  return Math.max(centavos(somaItens(itens) + frete - desconto), 0);
}

export function somaItens(itens: { quantidade: number; valor_unitario: number }[]): number {
  return centavos(itens.reduce((s, i) => s + centavos(i.quantidade * i.valor_unitario), 0));
}

export interface LinhaResumo {
  rotulo: string;
  valor: number;
}

/**
 * Linhas do quadro de valores do documento. O total impresso é sempre o
 * valor do evento (o que as parcelas cobram). Se ele não bate com itens +
 * frete − desconto, a diferença vira uma linha própria, para a conta
 * fechar no papel. Evento sem preço por item (combinado só no total)
 * mostra a locação como uma linha só.
 */
export function resumoValores(evento: {
  itens: { quantidade: number; valor_unitario: number }[];
  frete: number;
  desconto: number;
  valor_total: number;
}): { linhas: LinhaResumo[]; total: number; comPrecos: boolean } {
  const { frete, desconto } = evento;
  const total = centavos(evento.valor_total);
  const itens = somaItens(evento.itens);
  const comPrecos = itens > 0;
  const linhas: LinhaResumo[] = [];

  if (comPrecos) {
    linhas.push({ rotulo: "Subtotal dos itens", valor: itens });
  } else {
    linhas.push({ rotulo: "Locação dos itens", valor: centavos(total - frete + desconto) });
  }
  if (frete > 0) linhas.push({ rotulo: "Frete", valor: frete });
  if (desconto > 0) linhas.push({ rotulo: "Desconto", valor: -desconto });
  if (comPrecos) {
    const ajuste = centavos(total - (itens + frete - desconto));
    if (ajuste > 0) linhas.push({ rotulo: "Montagem e serviços", valor: ajuste });
    if (ajuste < 0) linhas.push({ rotulo: "Desconto adicional", valor: ajuste });
  }
  return { linhas, total, comPrecos };
}

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];

/** Número por extenso até 99 (prazos de locação); acima disso, só os algarismos. */
export function porExtenso(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 20) return UNIDADES[n] ?? String(n);
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const d = dezenas[Math.floor(n / 10)] ?? "";
  return n % 10 === 0 ? d : `${d} e ${UNIDADES[n % 10]}`;
}

/** "03 (três) dias" — da saída ao retorno das peças; no mínimo um dia. */
export function prazoLocacao(saida: string, retorno: string): string {
  const dias = Math.max(diferencaEmDias(saida, retorno), 1);
  return `${String(dias).padStart(2, "0")} (${porExtenso(dias)}) ${dias === 1 ? "dia" : "dias"}`;
}

const NOMES_PARCELA: Record<TipoParcela, string> = {
  sinal: "sinal",
  saldo: "saldo",
  parcela: "parcela",
  avista: "pagamento à vista",
  avaria: "cobrança de avaria",
};

/**
 * Como a locação será paga, para a cláusula do contrato. Usa as parcelas
 * do evento (sem as de avaria); sem parcelas, vale o combinado padrão:
 * tudo pago até o início da locação.
 */
export function condicaoPagamento(
  parcelas: {
    tipo: TipoParcela;
    valor: number;
    data_vencimento: string;
    status: "pendente" | "recebido";
    data_recebimento: string | null;
  }[]
): string {
  const lista = parcelas
    .filter((p) => p.tipo !== "avaria")
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  if (!lista.length) return "devendo ser integralmente pago até a data de início da locação";

  const parcelados = lista.filter((p) => p.tipo === "parcela").length;
  let n = 0;
  const partes = lista.map((p) => {
    const nome =
      p.tipo === "parcela" && parcelados > 1 ? `${++n}ª parcela` : NOMES_PARCELA[p.tipo];
    const quando =
      p.status === "recebido"
        ? `pago em ${formatarData(p.data_recebimento)}`
        : `até ${formatarData(p.data_vencimento)}`;
    return `${nome} de ${reais(Number(p.valor))}, ${quando}`;
  });
  return `pago da seguinte forma: ${partes.join("; ")}`;
}
