"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  PartyPopper,
  FileText,
  Package,
  Users,
  TrendingUp,
  Receipt,
  BarChart2,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Marca } from "./marca";

const navItems = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/eventos", label: "Eventos", icon: PartyPopper },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/acervo", label: "Acervo", icon: Package },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/receitas", label: "Receitas", icon: TrendingUp },
  { href: "/despesas", label: "Despesas", icon: Receipt },
  { href: "/relatorios", label: "Relatórios", icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  // Fecha o menu ao navegar (celular)
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra superior no celular */}
      <div className="lg:hidden print:hidden fixed top-0 inset-x-0 z-40 h-14 bg-oliva-escuro flex items-center justify-between px-4">
        <Marca clara />
        <button
          onClick={() => setAberto(true)}
          className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {aberto && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-oliva-escuro/50 backdrop-blur-[2px]"
          onClick={() => setAberto(false)}
        />
      )}

      <aside
        className={cn(
          "w-60 bg-oliva-escuro flex flex-col shrink-0 print:hidden",
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-200",
          "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-5 py-6 border-b border-white/10 flex items-center justify-between">
          <Marca clara />
          <button
            onClick={() => setAberto(false)}
            className="lg:hidden p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  ativo ? "bg-white/10 text-white" : "text-white/65 hover:text-white hover:bg-white/5"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", ativo ? "text-areia" : "text-current")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full
                       text-white/55 hover:text-white hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
