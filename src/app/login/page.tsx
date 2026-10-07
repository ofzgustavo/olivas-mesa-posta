"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Marca } from "@/components/layout/marca";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await createClient().auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro("E-mail ou senha inválidos.");
      setCarregando(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-oliva-escuro flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Marca clara className="scale-125" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-wider mb-1.5 text-white/50">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white
                         placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-areia"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-xs uppercase tracking-wider mb-1.5 text-white/50">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-white
                         placeholder:text-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-areia"
              placeholder="••••••••"
            />
          </div>

          {erro && <p className="text-red-300 text-sm text-center">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-areia text-oliva-escuro font-bold py-3 rounded-lg text-sm
                       hover:bg-areia-claro transition-colors disabled:opacity-50 mt-2"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
