"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Undo2, X } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import { hoje } from "@/lib/datas";

export function ParcelaAcoes({ parcelaId, recebida }: { parcelaId: string; recebida: boolean }) {
  const router = useRouter();
  const notificar = useToast();
  const [abrindo, setAbrindo] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [data, setData] = useState(hoje());
  const [enviando, setEnviando] = useState(false);
  const [atualizando, startTransition] = useTransition();
  const ocupado = enviando || atualizando;

  async function enviar(corpo: object, sucesso: string) {
    setEnviando(true);
    const r = await requisitar(`/api/parcelas/${parcelaId}`, "PATCH", corpo);
    setEnviando(false);
    if (!r.ok) {
      notificar("erro", r.erro);
      return false;
    }
    notificar("sucesso", sucesso);
    startTransition(() => router.refresh());
    return true;
  }

  if (recebida) {
    return (
      <>
        <button
          onClick={() => setDesfazendo(true)}
          className="p-1.5 text-cinza hover:text-amber-700 hover:bg-amber-50 rounded-md"
          title="Desfazer recebimento"
          aria-label="Desfazer recebimento"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <ConfirmDialog
          aberto={desfazendo}
          titulo="Desfazer recebimento"
          mensagem="A parcela volta a ficar pendente e sai das receitas. O status do evento não muda."
          rotuloConfirmar="Desfazer"
          confirmando={ocupado}
          onConfirmar={async () => {
            if (await enviar({ acao: "desfazer" }, "Recebimento desfeito.")) setDesfazendo(false);
          }}
          onCancelar={() => setDesfazendo(false)}
        />
      </>
    );
  }

  if (abrindo) {
    return (
      <div className="flex items-center gap-1.5">
        <DateInput value={data} onChange={setData} className="text-xs py-1 w-28" />
        <button
          onClick={async () => {
            if (await enviar({ acao: "receber", data_recebimento: data }, "Pagamento registrado.")) {
              setAbrindo(false);
            }
          }}
          disabled={ocupado || !data}
          className="flex items-center gap-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700
                     px-2.5 py-1.5 rounded-lg disabled:opacity-50"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {ocupado ? "..." : "Confirmar"}
        </button>
        <button
          onClick={() => setAbrindo(false)}
          className="p-1.5 text-cinza hover:text-red-500 rounded-lg"
          aria-label="Cancelar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setAbrindo(true)}
      className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50
                 hover:bg-emerald-100 px-3 py-1.5 rounded-lg whitespace-nowrap"
    >
      <CheckCircle className="w-3.5 h-3.5" />
      Recebido
    </button>
  );
}
