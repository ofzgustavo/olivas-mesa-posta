"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type TipoToast = "sucesso" | "erro";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensagem: string;
}

type NotificarFn = (tipo: TipoToast, mensagem: string) => void;

const ToastContext = createContext<NotificarFn>(() => {});

export function useToast(): NotificarFn {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notificar = useCallback<NotificarFn>((tipo, mensagem) => {
    const id = Date.now() + Math.random();
    setToasts((atuais) => [...atuais, { id, tipo, mensagem }]);
    setTimeout(() => {
      setToasts((atuais) => atuais.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={notificar}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 shadow-lg bg-white text-sm animate-toast-in",
              toast.tipo === "sucesso" ? "border-emerald-200" : "border-red-200"
            )}
          >
            {toast.tipo === "sucesso" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            )}
            <p className="text-tinta flex-1">{toast.mensagem}</p>
            <button
              onClick={() =>
                setToasts((atuais) => atuais.filter((t) => t.id !== toast.id))
              }
              className="text-cinza hover:text-oliva shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
