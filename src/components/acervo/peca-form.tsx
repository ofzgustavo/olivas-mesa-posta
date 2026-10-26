"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import { parseValor } from "@/lib/utils";
import { CATEGORIAS_PECA, type PecaEstoque } from "@/types";

export function PecaForm({ peca }: { peca?: PecaEstoque }) {
  const router = useRouter();
  const notificar = useToast();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [quantidade, setQuantidade] = useState(String(peca?.estoque ?? ""));

  const novaQtd = Number(quantidade);
  const mudouEstoque = peca != null && quantidade !== "" && novaQtd !== peca.estoque;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);

    const form = new FormData(e.currentTarget);
    const valorTexto = String(form.get("valor_reposicao") ?? "");
    const valor = valorTexto.trim() ? parseValor(valorTexto) : null;
    if (valor != null && (Number.isNaN(valor) || valor < 0)) {
      setErro("Valor de reposição inválido.");
      return;
    }
    const locacaoTexto = String(form.get("valor_locacao") ?? "");
    const locacao = locacaoTexto.trim() ? parseValor(locacaoTexto) : null;
    if (locacao != null && (Number.isNaN(locacao) || locacao < 0)) {
      setErro("Preço de locação inválido.");
      return;
    }

    setSalvando(true);
    const corpo = {
      nome: form.get("nome"),
      categoria: form.get("categoria"),
      valor_reposicao: valor,
      valor_locacao: locacao,
      observacoes: form.get("observacoes"),
      quantidade: novaQtd,
      ...(peca ? { ativo: form.get("ativo") === "on" } : {}),
    };
    const resultado = peca
      ? await requisitar(`/api/acervo/${peca.id}`, "PATCH", corpo)
      : await requisitar<{ id: string }>("/api/acervo", "POST", corpo);

    if (!resultado.ok) {
      setErro(resultado.erro);
      setSalvando(false);
      return;
    }

    notificar("sucesso", peca ? "Peça atualizada." : "Peça cadastrada.");
    router.push(peca ? `/acervo/${peca.id}` : "/acervo");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="cartao space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="nome">Nome da peça *</label>
          <input
            id="nome"
            name="nome"
            required
            defaultValue={peca?.nome}
            className="campo"
            placeholder="Ex.: Prato raso porcelana branca"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="categoria">Categoria *</label>
          <select id="categoria" name="categoria" required defaultValue={peca?.categoria ?? ""} className="campo">
            <option value="" disabled>Selecione</option>
            {Object.entries(CATEGORIAS_PECA).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="rotulo" htmlFor="quantidade">
            {peca ? "Quantidade no acervo hoje *" : "Quantidade que vocês têm *"}
          </label>
          <input
            id="quantidade"
            type="number"
            min={0}
            step={1}
            required
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="campo"
          />
          {mudouEstoque && (
            <p className="text-xs text-amber-700 mt-1">
              Será registrado um ajuste de {novaQtd - peca.estoque > 0 ? "+" : ""}
              {novaQtd - peca.estoque} no histórico. Para compras, prefira lançar a despesa de
              aquisição/reposição — ela já soma no acervo.
            </p>
          )}
        </div>
        <div>
          <label className="rotulo" htmlFor="valor_locacao">Preço de locação por unidade (R$)</label>
          <input
            id="valor_locacao"
            name="valor_locacao"
            inputMode="decimal"
            defaultValue={peca?.valor_locacao != null ? String(peca.valor_locacao).replace(".", ",") : ""}
            className="campo"
            placeholder="0,00"
          />
          <p className="text-xs text-cinza mt-1">Sugerido ao escolher a peça num evento.</p>
        </div>
        <div>
          <label className="rotulo" htmlFor="valor_reposicao">Valor de reposição por unidade (R$)</label>
          <input
            id="valor_reposicao"
            name="valor_reposicao"
            inputMode="decimal"
            defaultValue={peca?.valor_reposicao != null ? String(peca.valor_reposicao).replace(".", ",") : ""}
            className="campo"
            placeholder="0,00"
          />
          <p className="text-xs text-cinza mt-1">Sai no contrato e sugere a cobrança de quebra ou perda.</p>
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="observacoes">Observações</label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          defaultValue={peca?.observacoes ?? ""}
          className="campo resize-none"
          placeholder="Fornecedor, cuidados na lavagem…"
        />
      </div>

      {peca && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={peca.ativo} className="rounded border-gray-300 text-oliva" />
          Peça ativa (desmarque para tirá-la das listas sem perder o histórico)
        </label>
      )}

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
