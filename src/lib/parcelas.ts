// Geração das condições de pagamento de um evento. Puro (sem banco nem
// React) para ser testado direto no `node --test`.

import { somarMeses } from "./datas.ts";
import type { TipoParcela } from "../types/index.ts";

export interface ParcelaRascunho {
  id?: string;
  tipo: TipoParcela;
  valor: number;
  data_vencimento: string;
  // parcelas já recebidas aparecem no formulário, mas não são editáveis
  recebida?: boolean;
}

export type Condicao =
  | { forma: "avista"; vencimento: string }
  | { forma: "sinal_saldo"; percentualSinal: number; vencimentoSinal: string; vencimentoSaldo: string }
  | { forma: "parcelado"; vezes: number; primeiroVencimento: string };

/** Arredonda para centavos sem os erros de ponto flutuante de 0.1 + 0.2. */
export function centavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Divide `total` em `vezes` parcelas que somam exatamente o total: a
 * diferença de centavos da divisão vai para a primeira parcela
 * (1000 / 3 → 333,34 + 333,33 + 333,33).
 */
export function dividirValor(total: number, vezes: number): number[] {
  if (vezes < 1) return [];
  const totalCentavos = Math.round(total * 100);
  const base = Math.floor(totalCentavos / vezes);
  const resto = totalCentavos - base * vezes;
  return Array.from({ length: vezes }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
}

/** Monta as parcelas de uma condição de pagamento. */
export function gerarParcelas(total: number, condicao: Condicao): ParcelaRascunho[] {
  if (!(total > 0)) return [];

  if (condicao.forma === "avista") {
    return [{ tipo: "avista", valor: centavos(total), data_vencimento: condicao.vencimento }];
  }

  if (condicao.forma === "sinal_saldo") {
    const pct = Math.min(Math.max(condicao.percentualSinal, 0), 100);
    const sinal = centavos((total * pct) / 100);
    const saldo = centavos(total - sinal);
    const parcelas: ParcelaRascunho[] = [];
    if (sinal > 0) {
      parcelas.push({ tipo: "sinal", valor: sinal, data_vencimento: condicao.vencimentoSinal });
    }
    if (saldo > 0) {
      parcelas.push({ tipo: "saldo", valor: saldo, data_vencimento: condicao.vencimentoSaldo });
    }
    return parcelas;
  }

  const vezes = Math.max(1, Math.floor(condicao.vezes));
  return dividirValor(total, vezes).map((valor, i) => ({
    tipo: "parcela" as const,
    valor,
    data_vencimento: somarMeses(condicao.primeiroVencimento, i),
  }));
}

/** Soma das parcelas, em reais, sem erro de ponto flutuante. */
export function somaParcelas(parcelas: { valor: number }[]): number {
  return Math.round(parcelas.reduce((s, p) => s + Math.round(p.valor * 100), 0)) / 100;
}
