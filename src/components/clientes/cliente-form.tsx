"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import type { Cliente } from "@/types";

export function ClienteForm({ cliente }: { cliente?: Cliente }) {
  const router = useRouter();
  const notificar = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    const corpo = Object.fromEntries(new FormData(e.currentTarget));
    const resultado = cliente
      ? await requisitar(`/api/clientes/${cliente.id}`, "PATCH", corpo)
      : await requisitar("/api/clientes", "POST", corpo);

    if (!resultado.ok) {
      setErro(resultado.erro);
      setSalvando(false);
      return;
    }

    notificar("sucesso", cliente ? "Cliente atualizado." : "Cliente cadastrado.");
    router.push("/clientes");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="cartao space-y-4 max-w-2xl">
      <div>
        <label className="rotulo" htmlFor="nome">Nome *</label>
        <input id="nome" name="nome" required defaultValue={cliente?.nome} className="campo" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="rotulo" htmlFor="telefone">Telefone / WhatsApp</label>
          <input id="telefone" name="telefone" defaultValue={cliente?.telefone ?? ""} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" defaultValue={cliente?.email ?? ""} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="cpf_cnpj">CPF / CNPJ</label>
          <input id="cpf_cnpj" name="cpf_cnpj" defaultValue={cliente?.cpf_cnpj ?? ""} className="campo" />
        </div>
        <div>
          <label className="rotulo" htmlFor="endereco">Endereço</label>
          <input id="endereco" name="endereco" defaultValue={cliente?.endereco ?? ""} className="campo" />
        </div>
      </div>
      <div>
        <label className="rotulo" htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          defaultValue={cliente?.observacoes ?? ""}
          className="campo resize-none"
        />
      </div>

      {erro && <p className="text-red-600 text-sm">{erro}</p>}

      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={salvando} className="btn-primario">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-contorno">
          Cancelar
        </button>
      </div>
    </form>
  );
}
