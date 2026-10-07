"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { requisitar } from "@/lib/requisitar";
import type { StatusEvento } from "@/types";

type Acao = { para: StatusEvento; rotulo: string; confirmar?: string };

// O que faz sentido oferecer a partir de cada status. Ir de orçamento
// para confirmado não está aqui de propósito: quem confirma é o
// primeiro pagamento registrado.
const ACOES: Record<StatusEvento, Acao[]> = {
  orcamento: [
    { para: "cancelado", rotulo: "Cancelar", confirmar: "Cancelar este orçamento?" },
  ],
  confirmado: [
    { para: "realizado", rotulo: "Marcar como realizado" },
    {
      para: "cancelado",
      rotulo: "Cancelar evento",
      confirmar:
        "As peças voltam a ficar livres. Pagamentos já recebidos continuam nas receitas — se houver devolução, lance-a à parte.",
    },
  ],
  realizado: [{ para: "confirmado", rotulo: "Voltar para confirmado" }],
  cancelado: [{ para: "orcamento", rotulo: "Reabrir como orçamento" }],
};

export function StatusAcoes({ eventoId, status }: { eventoId: string; status: StatusEvento }) {
  const router = useRouter();
  const notificar = useToast();
  const [pendente, setPendente] = useState<Acao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  async function aplicar(acao: Acao) {
    setEnviando(true);
    const r = await requisitar(`/api/eventos/${eventoId}/status`, "PATCH", { status: acao.para });
    setEnviando(false);
    setPendente(null);
    if (!r.ok) {
      notificar("erro", r.erro);
      return;
    }
    notificar("sucesso", "Status atualizado.");
    startTransition(() => router.refresh());
  }

  return (
    <>
      {ACOES[status].map((acao) => (
        <button
          key={acao.para}
          disabled={enviando}
          onClick={() => (acao.confirmar ? setPendente(acao) : aplicar(acao))}
          className={acao.para === "cancelado" ? "btn-contorno text-red-700 border-red-200 hover:bg-red-50" : "btn-contorno"}
        >
          {acao.rotulo}
        </button>
      ))}
      <ConfirmDialog
        aberto={pendente != null}
        titulo={pendente?.rotulo ?? ""}
        mensagem={pendente?.confirmar ?? ""}
        rotuloConfirmar="Confirmar"
        confirmando={enviando}
        onConfirmar={() => pendente && aplicar(pendente)}
        onCancelar={() => setPendente(null)}
      />
    </>
  );
}
