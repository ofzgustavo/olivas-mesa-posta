import { cn, statusEfetivo } from "@/lib/utils";
import { STATUS_EVENTO, STATUS_PARCELA, type StatusEvento } from "@/types";

const COR_EVENTO: Record<StatusEvento, string> = {
  orcamento: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  confirmado: "bg-oliva/10 text-oliva-escuro ring-1 ring-oliva/20",
  realizado: "bg-gray-100 text-gray-700",
  cancelado: "bg-red-50 text-red-700 line-through",
};

export function SeloEvento({ status }: { status: StatusEvento }) {
  return <span className={cn("selo", COR_EVENTO[status])}>{STATUS_EVENTO[status]}</span>;
}

const COR_PARCELA = {
  pendente: "bg-amber-50 text-amber-800",
  recebido: "bg-emerald-50 text-emerald-800",
  vencido: "bg-red-50 text-red-700",
} as const;

export function SeloParcela({ parcela }: { parcela: { status: string; data_vencimento: string } }) {
  const status = statusEfetivo(parcela);
  return <span className={cn("selo", COR_PARCELA[status])}>{STATUS_PARCELA[status]}</span>;
}
