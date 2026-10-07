"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";

interface ActionButtonsProps {
  editHref?: string;
  deleteUrl: string;
  deleteConfirmMessage?: string;
  redirectAfterDelete?: string;
}

export function ActionButtons({
  editHref,
  deleteUrl,
  deleteConfirmMessage = "Tem certeza que deseja excluir? Esta ação não pode ser desfeita.",
  redirectAfterDelete,
}: ActionButtonsProps) {
  const router = useRouter();
  const notificar = useToast();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function handleDelete() {
    setExcluindo(true);
    const resultado = await requisitar(deleteUrl, "DELETE");
    setExcluindo(false);

    if (!resultado.ok) {
      notificar("erro", resultado.erro);
      return;
    }

    notificar("sucesso", "Excluído com sucesso.");
    setConfirmando(false);
    if (redirectAfterDelete) router.push(redirectAfterDelete);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {editHref && (
        <Link
          href={editHref}
          className="p-1.5 text-cinza hover:text-oliva hover:bg-oliva/5 rounded-md transition-colors"
          title="Editar"
          aria-label="Editar"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Link>
      )}
      <button
        onClick={() => setConfirmando(true)}
        disabled={excluindo}
        className="p-1.5 text-cinza hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
        title="Excluir"
        aria-label="Excluir"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <ConfirmDialog
        aberto={confirmando}
        titulo="Confirmar exclusão"
        mensagem={deleteConfirmMessage}
        confirmando={excluindo}
        onConfirmar={handleDelete}
        onCancelar={() => setConfirmando(false)}
      />
    </div>
  );
}
