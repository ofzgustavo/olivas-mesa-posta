import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hoje } from "@/lib/datas";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatCurrency(value: number | string | null | undefined): string {
  return BRL.format(Number(value ?? 0));
}

export { parseValor } from "@/lib/valores";

export function isVencido(dataVencimento: string): boolean {
  // Vencido só depois do fim do dia do vencimento (quem vence hoje ainda não venceu)
  return dataVencimento < hoje();
}

// Status real da parcela: o banco não grava "vencido", ele é derivado da data.
export function statusEfetivo(parcela: {
  status: string;
  data_vencimento: string;
}): "pendente" | "recebido" | "vencido" {
  if (parcela.status === "recebido") return "recebido";
  return isVencido(parcela.data_vencimento) ? "vencido" : "pendente";
}

// O supabase-js tipa embeds (relações) como objeto ou array, conforme a
// cardinalidade que ele consegue inferir. Isto devolve sempre um objeto.
export function umOuNenhum<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}
