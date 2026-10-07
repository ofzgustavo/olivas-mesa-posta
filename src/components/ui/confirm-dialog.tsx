"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  confirmando?: boolean;
  rotuloConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  confirmando,
  rotuloConfirmar = "Excluir",
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oliva-escuro/40 backdrop-blur-[2px]"
      onClick={onCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <h3 className="font-titulo text-xl text-oliva-escuro">{titulo}</h3>
            <p className="text-sm text-cinza mt-1 leading-relaxed">{mensagem}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onCancelar} className="btn-contorno" disabled={confirmando}>
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={confirmando}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm
                       hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmando ? "Aguarde..." : rotuloConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
