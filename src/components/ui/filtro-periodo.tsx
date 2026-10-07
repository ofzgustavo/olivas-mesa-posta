"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";

// Período na URL (?inicio=&fim=), para a página servidora ler e para o
// filtro sobreviver a um recarregar ou a um link compartilhado.
export function FiltroPeriodo({
  inicio,
  fim,
  rotulo = "Período",
}: {
  inicio: string;
  fim: string;
  rotulo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [de, setDe] = useState(inicio);
  const [ate, setAte] = useState(fim);
  const invalido = !de || !ate || de > ate;

  function aplicar() {
    if (invalido) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("inicio", de);
    params.set("fim", ate);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-cinza">{rotulo}</span>
      <DateInput value={de} onChange={setDe} className="text-xs py-1.5 w-32" />
      <span className="text-xs text-cinza">até</span>
      <DateInput value={ate} onChange={setAte} className="text-xs py-1.5 w-32" />
      <button onClick={aplicar} disabled={invalido} className="btn-primario py-1.5 text-xs">
        Ver
      </button>
    </div>
  );
}
