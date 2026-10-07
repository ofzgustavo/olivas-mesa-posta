import { NextResponse } from "next/server";
import { isDataISO } from "@/lib/datas";

export function erro(mensagem: string, status = 400) {
  return NextResponse.json({ error: mensagem }, { status });
}

export async function lerJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const corpo: unknown = await request.json();
    return corpo && typeof corpo === "object" && !Array.isArray(corpo)
      ? (corpo as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

export function numero(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export function inteiro(valor: unknown): number | null {
  const n = numero(valor);
  return n != null && Number.isInteger(n) ? n : null;
}

export function data(valor: unknown): string | null {
  return isDataISO(valor) ? valor : null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid(valor: unknown): string | null {
  return typeof valor === "string" && UUID.test(valor) ? valor : null;
}

/**
 * Traduz o erro do banco para algo que a usuária entenda. As regras de
 * negócio do schema (RAISE EXCEPTION ... P0001) já vêm em português e
 * passam direto; erros técnicos viram uma frase genérica.
 */
export function mensagemDoBanco(e: { code?: string; message: string }): string {
  if (e.code === "P0001") return e.message;
  if (e.code === "23503") {
    return "Não é possível concluir: existem registros vinculados a este item.";
  }
  if (e.code === "23505") return "Já existe um registro com esse nome.";
  if (e.code === "23514") return "Algum valor informado é inválido.";
  return "Erro ao salvar. Confira os dados e tente novamente.";
}
