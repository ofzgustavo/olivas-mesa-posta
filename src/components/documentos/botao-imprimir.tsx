"use client";

import { Printer } from "lucide-react";

// O navegador abre a janela de impressão; nela dá para escolher
// "Salvar como PDF" (no iPhone: Compartilhar → Imprimir → pinça na prévia).
export function BotaoImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primario">
      <Printer className="w-4 h-4" /> Imprimir ou salvar PDF
    </button>
  );
}
