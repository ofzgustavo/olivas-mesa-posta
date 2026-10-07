// Aritmética de datas do sistema.
//
// Regra de ouro: nunca misturar data com hora. Todas as datas do banco
// são DATE (YYYY-MM-DD, sem fuso), e o servidor da Vercel roda em UTC.
// Se "hoje" viesse de `new Date()` formatado no fuso do servidor, todo
// dia entre 21h e meia-noite o sistema acharia que já é amanhã: parcela
// que vence hoje apareceria vencida, e o "este mês" do último dia do mês
// já mostraria o mês seguinte. Por isso tudo aqui é string YYYY-MM-DD e a
// conversão "instante → dia em Brasília" acontece num lugar só.
//
// Sem dependências externas de propósito: roda igual no servidor, no
// navegador e no `node --test`.

export const FUSO = "America/Sao_Paulo";

const FORMATO_ISO = /^\d{4}-\d{2}-\d{2}$/;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/**
 * O dia de hoje em Brasília, como YYYY-MM-DD.
 *
 * Usa o locale en-CA porque ele formata datas exatamente como ISO
 * (2026-07-27), evitando montar a string na mão a partir de partes.
 */
export function hoje(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
}

// `slice` sempre devolve string (diferente de indexar um array, que com
// noUncheckedIndexedAccess pode ser undefined), então o formato é validado
// pelo regex antes e a conversão numérica fica garantida.
function decompor(dataISO: string): { ano: number; mes: number; dia: number } | null {
  if (!FORMATO_ISO.test(dataISO)) return null;

  const ano = Number(dataISO.slice(0, 4));
  const mes = Number(dataISO.slice(5, 7));
  const dia = Number(dataISO.slice(8, 10));

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  // Rejeita 31/02 e afins: se o Date "transbordar", o dia muda.
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }

  return { ano, mes, dia };
}

function exigir(dataISO: string): { ano: number; mes: number; dia: number } {
  const partes = decompor(dataISO);
  if (!partes) throw new Error(`Data inválida: ${dataISO} (esperado YYYY-MM-DD)`);
  return partes;
}

/** `true` se o valor é uma data ISO plausível (YYYY-MM-DD, calendário válido). */
export function isDataISO(valor: unknown): valor is string {
  return typeof valor === "string" && decompor(valor) !== null;
}

function formatarISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/**
 * Soma dias a uma data ISO, devolvendo outra data ISO.
 *
 * A conta é feita em UTC puro: como não há horário envolvido, não existe
 * horário de verão nem borda de fuso para atrapalhar.
 */
export function somarDias(dataISO: string, dias: number): string {
  const { ano, mes, dia } = exigir(dataISO);
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return formatarISO(base);
}

/**
 * Soma meses mantendo o dia — e, se o mês de destino for mais curto,
 * cai no último dia dele (31/01 + 1 mês = 28/02 ou 29/02).
 */
export function somarMeses(dataISO: string, meses: number): string {
  const { ano, mes, dia } = exigir(dataISO);
  const alvo = new Date(Date.UTC(ano, mes - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return formatarISO(alvo);
}

/** Dias entre duas datas ISO (fim − início). */
export function diferencaEmDias(inicio: string, fim: string): number {
  const a = exigir(inicio);
  const b = exigir(fim);
  return Math.round(
    (Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000
  );
}

/** Primeiro dia do mês da data. */
export function inicioDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

/** Último dia do mês da data. */
export function fimDoMes(dataISO: string): string {
  const { ano, mes } = exigir(dataISO);
  return formatarISO(new Date(Date.UTC(ano, mes, 0)));
}

/** Dia da semana: 0 = domingo … 6 = sábado. */
export function diaDaSemana(dataISO: string): number {
  const { ano, mes, dia } = exigir(dataISO);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Todas as datas de `inicio` a `fim`, inclusive. */
export function diasEntre(inicio: string, fim: string): string[] {
  const total = diferencaEmDias(inicio, fim);
  return Array.from({ length: Math.max(total + 1, 0) }, (_, i) => somarDias(inicio, i));
}

/** Todos os meses (YYYY-MM) de `inicio` a `fim`, inclusive. */
export function mesesEntre(inicio: string, fim: string): string[] {
  const meses: string[] = [];
  let atual = inicioDoMes(inicio);
  while (atual.slice(0, 7) <= fim.slice(0, 7)) {
    meses.push(atual.slice(0, 7));
    atual = somarMeses(atual, 1);
  }
  return meses;
}

/** `true` se os períodos [a1, a2] e [b1, b2] têm ao menos um dia em comum. */
export function periodosSobrepoem(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2;
}

/** 2026-08-01 → 01/08/2026. Devolve "—" para vazio. */
export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return "—";
  if (!isDataISO(dataISO)) return dataISO;
  return `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}/${dataISO.slice(0, 4)}`;
}

/** 2026-08-01 → 01/08 (listas e gráficos). */
export function formatarDiaMes(dataISO: string): string {
  return `${dataISO.slice(8, 10)}/${dataISO.slice(5, 7)}`;
}

/** 2026-08 (ou 2026-08-15) → "agosto de 2026". */
export function formatarMesAno(data: string): string {
  const mes = Number(data.slice(5, 7));
  return `${MESES[mes - 1] ?? ""} de ${data.slice(0, 4)}`;
}

/** 2026-08 → "ago/26" (eixo de gráfico). */
export function formatarMesCurto(data: string): string {
  const mes = Number(data.slice(5, 7));
  return `${MESES_CURTOS[mes - 1] ?? ""}/${data.slice(2, 4)}`;
}
