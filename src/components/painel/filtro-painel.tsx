"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";
import { cn } from "@/lib/utils";

const PRESETS = [
  { rotulo: "Este mês", valor: "este_mes" },
  { rotulo: "Mês passado", valor: "mes_passado" },
  { rotulo: "Este ano", valor: "este_ano" },
  { rotulo: "Personalizado", valor: "personalizado" },
];

export function FiltroPainel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodo = searchParams.get("periodo") ?? "este_mes";
  const [personalizado, setPersonalizado] = useState(periodo === "personalizado");
  const [de, setDe] = useState(searchParams.get("de") ?? "");
  const [ate, setAte] = useState(searchParams.get("ate") ?? "");

  function ir(novo: string, inicio?: string, fim?: string) {
    const p = new URLSearchParams({ periodo: novo });
    if (inicio) p.set("de", inicio);
    if (fim) p.set("ate", fim);
    router.push(`/?${p}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const ativo = p.valor === "personalizado" ? personalizado : !personalizado && periodo === p.valor;
        return (
          <button
            key={p.valor}
            onClick={() => {
              if (p.valor === "personalizado") return setPersonalizado(true);
              setPersonalizado(false);
              ir(p.valor);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              ativo ? "bg-oliva text-white" : "bg-white border border-black/10 text-cinza hover:border-oliva"
            )}
          >
            {p.rotulo}
          </button>
        );
      })}
      {personalizado && (
        <div className="flex flex-wrap items-center gap-1.5">
          <DateInput value={de} onChange={setDe} className="text-xs py-1.5 w-28" placeholder="de" />
          <DateInput value={ate} onChange={setAte} className="text-xs py-1.5 w-28" placeholder="até" />
          <button
            onClick={() => ir("personalizado", de, ate)}
            disabled={!de || !ate || de > ate}
            className="btn-primario py-1.5 text-xs"
          >
            Ver
          </button>
        </div>
      )}
    </div>
  );
}
