import { cn } from "@/lib/utils";

// Marca em texto até a Olivas ter logo próprio. Para trocar por imagem,
// basta substituir o conteúdo deste componente.
export function Marca({ clara = false, className }: { clara?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0" aria-hidden="true">
        <path
          d="M6 26 C 12 20, 18 14, 27 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className={clara ? "text-areia-claro" : "text-oliva"}
        />
        <ellipse cx="13" cy="15" rx="5.2" ry="2.6" transform="rotate(-50 13 15)"
          className={clara ? "fill-areia" : "fill-oliva-claro"} />
        <ellipse cx="20.5" cy="14.5" rx="4.6" ry="2.3" transform="rotate(30 20.5 14.5)"
          className={clara ? "fill-areia-claro" : "fill-areia"} />
        <circle cx="10" cy="22" r="2.6" className={clara ? "fill-areia-claro" : "fill-oliva-escuro"} />
      </svg>
      <div className="leading-none">
        <p className={cn("font-titulo text-2xl font-semibold", clara ? "text-white" : "text-oliva-escuro")}>
          Olivas
        </p>
        <p className={cn("text-[10px] tracking-[0.3em] uppercase mt-0.5", clara ? "text-areia-claro" : "text-cinza")}>
          Mesa Posta
        </p>
      </div>
    </div>
  );
}
