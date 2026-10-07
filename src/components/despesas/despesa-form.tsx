"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import { formatarData, hoje } from "@/lib/datas";
import { parseValor } from "@/lib/utils";
import {
  CATEGORIAS_COM_PECA,
  CATEGORIAS_DESPESA,
  type CategoriaDespesa,
  type Despesa,
} from "@/types";

type Opcao = { id: string; nome: string };
type EventoOpcao = { id: string; titulo: string; data_evento: string };

export function DespesaForm({
  despesa,
  eventos,
  pecas,
  eventoInicial,
}: {
  despesa?: Despesa;
  eventos: EventoOpcao[];
  pecas: Opcao[];
  eventoInicial?: string;
}) {
  const router = useRouter();
  const notificar = useToast();
  const [data, setData] = useState(despesa?.data ?? hoje());
  const [categoria, setCategoria] = useState<CategoriaDespesa | "">(despesa?.categoria ?? "");
  // Compra de peça quase sempre é para o acervo: nova despesa já vem marcada.
  const [entraNoAcervo, setEntraNoAcervo] = useState(despesa ? despesa.peca_id != null : true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aceitaPeca = categoria !== "" && CATEGORIAS_COM_PECA.includes(categoria);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = new FormData(e.currentTarget);
    const valor = parseValor(String(form.get("valor") ?? ""));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Valor inválido.");
      return;
    }

    const comPeca = aceitaPeca && entraNoAcervo;
    const corpo = {
      data,
      valor,
      categoria,
      descricao: form.get("descricao"),
      evento_id: form.get("evento_id") || null,
      peca_id: comPeca ? form.get("peca_id") || null : null,
      quantidade_pecas: comPeca ? Number(form.get("quantidade_pecas")) : null,
    };

    setSalvando(true);
    const r = despesa
      ? await requisitar(`/api/despesas/${despesa.id}`, "PATCH", corpo)
      : await requisitar("/api/despesas", "POST", corpo);
    if (!r.ok) {
      setErro(r.erro);
      setSalvando(false);
      return;
    }
    notificar("sucesso", despesa ? "Despesa atualizada." : "Despesa lançada.");
    router.push(corpo.evento_id && !despesa ? `/eventos/${corpo.evento_id}` : "/despesas");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="cartao space-y-4 max-w-2xl">
      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="rotulo" htmlFor="data">Data *</label>
          <DateInput id="data" value={data} onChange={setData} required />
        </div>
        <div>
          <label className="rotulo" htmlFor="valor">Valor (R$) *</label>
          <input
            id="valor"
            name="valor"
            inputMode="decimal"
            required
            defaultValue={despesa ? String(despesa.valor).replace(".", ",") : ""}
            className="campo"
            placeholder="0,00"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="categoria">Categoria *</label>
          <select
            id="categoria"
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaDespesa)}
            className="campo"
          >
            <option value="" disabled>Selecione</option>
            {Object.entries(CATEGORIAS_DESPESA).map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="rotulo" htmlFor="descricao">Descrição *</label>
        <input
          id="descricao"
          name="descricao"
          required
          defaultValue={despesa?.descricao}
          className="campo"
          placeholder="Ex.: Frete ida e volta, 20 taças de cristal…"
        />
      </div>

      <div>
        <label className="rotulo" htmlFor="evento_id">Evento (opcional)</label>
        <select
          id="evento_id"
          name="evento_id"
          defaultValue={despesa?.evento_id ?? eventoInicial ?? ""}
          className="campo"
        >
          <option value="">— Despesa geral, sem evento —</option>
          {eventos.map((e) => (
            <option key={e.id} value={e.id}>
              {formatarData(e.data_evento)} · {e.titulo}
            </option>
          ))}
        </select>
        <p className="text-xs text-cinza mt-1">Ligada a um evento, a despesa entra no resultado dele.</p>
      </div>

      {aceitaPeca && (
        <div className="rounded-lg bg-fundo p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={entraNoAcervo}
              onChange={(e) => setEntraNoAcervo(e.target.checked)}
              className="rounded border-gray-300 text-oliva"
            />
            As peças compradas entram no acervo
          </label>
          {entraNoAcervo && (
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="rotulo" htmlFor="peca_id">Peça</label>
                <select
                  id="peca_id"
                  name="peca_id"
                  required
                  defaultValue={despesa?.peca_id ?? ""}
                  className="campo"
                >
                  <option value="" disabled>Selecione</option>
                  {pecas.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-cinza mt-1">
                  Peça nova? Cadastre-a primeiro em Acervo com quantidade 0.
                </p>
              </div>
              <div>
                <label className="rotulo" htmlFor="quantidade_pecas">Quantidade</label>
                <input
                  id="quantidade_pecas"
                  name="quantidade_pecas"
                  type="number"
                  min={1}
                  required
                  defaultValue={despesa?.quantidade_pecas ?? ""}
                  className="campo"
                />
              </div>
            </div>
          )}
        </div>
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
