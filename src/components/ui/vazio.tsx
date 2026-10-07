import type { LucideIcon } from "lucide-react";

export function Vazio({ icone: Icone, children }: { icone: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="text-center py-12">
      <Icone className="w-10 h-10 text-black/15 mx-auto mb-3" />
      <div className="text-cinza text-sm">{children}</div>
    </div>
  );
}
