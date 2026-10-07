"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/components/ui/toast";
import { requisitar } from "@/lib/requisitar";
import { hoje, somarDias } from "@/lib/datas";
import { formatCurrency, parseValor } from "@/lib/utils";
import { TIPOS_AVARIA, type TipoAvaria } from "@/types";

type PecaDoEvento = { id: string; nome: string; valor_reposicao: number | null; quantidade: number };

export function AvariaForm({ eventoId, pecas }: { eventoId: string; pecas: PecaDoEvento[] }) {
  const router = useRouter();
  const notificar = useToast();
  const [aberto, setAberto] = useState(false);
  const [pecaId, setPecaId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [tipo, setTipo] = useState<TipoAvaria>("quebra");
  const [valor, setValor] = useState("");
  const [valorEditado, setValorEditado] = useState(false);
  const [data, setData] = useState(hoje());
  const [vencimento, setVencimento] = useState(somarDias(hoje(), 7));
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  const peca = pecas.find((p) => p.id === pecaId);
  const sugestao =
    peca?.valor_reposicao != null && Number(quantidade) > 0
      ? Math.round(peca.valor_reposicao * Number(quantidade) * 100) / 100
      : null;
  const valorExibido = valorEditado ? valor : sugestao != null ? sugestao.toFixed(2).replace(".", ",") : valor;

  async function salvar() {
    const v = parseValor(valorExibido);
    setEnviando(true);
    const r = await requisitar("/api/avarias", "POST", {
      evento_id: eventoId,
      peca_id: pecaId,
      quantidade: Number(quantidade),
      tipo,
      valor: Number.isFinite(v) ? v : null,
      data,
      vencimento,
      observacoes,
    });
    setEnviando(false);
    if (!r.ok) {
      notificar("erro", r.erro);
      return;
    }
    notificar("sucesso", "Avaria registrada e cobrança gerada.");
    setAberto(false);
    setPecaId("");
    setQuantidade("1");
    setValor("");
    setValorEditado(false);
    setObservacoes("");
    startTransition(() => router.refresh());
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm text-oliva hover:underline flex items-center gap-1">
        <Plus className="w-4 h-4" /> Registrar quebra, dano ou perda
      </button>
    );
  }

  return (
    <div className="rounded-lg bg-fundo p-4 space-y-3">
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="rotulo" htmlFor="avaria-peca">Peça</label>
          <select id="avaria-peca" value={pecaId} onChange={(e) => setPecaId(e.target.value)} className="campo">
            <option value="" disabled>Selecione</option>
            {pecas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome} ({p.quantidade} no evento)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="rotulo" htmlFor="avaria-qtd">Quantidade</label>
          <input
            id="avaria-qtd"
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            className="campo"
          />
        </div>
        <div>
          <label className="rotulo" htmlFor="avaria-tipo">O que houve</label>
          <select
            id="avaria-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoAvaria)}
            className="campo"
          >
            {Object.entries(TIPOS_AVARIA).map(([v, r]) => (
              <option key={v} value={v}>{r}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="rotulo" htmlFor="avaria-valor">Valor a cobrar (R$)</label>
          <input
            id="avaria-valor"
            inputMode="decimal"
            value={valorExibido}
            onChange={(e) => {
              setValorEditado(true);
              setValor(e.target.value);
            }}
            className="campo"
            placeholder="0,00"
          />
          {sugestao != null && !valorEditado && (
            <p className="text-xs text-cinza mt-1">Sugestão: reposição × quantidade ({formatCurrency(sugestao)})</p>
          )}
        </div>
        <div>
          <label className="rotulo" htmlFor="avaria-data">Data da avaria</label>
          <DateInput id="avaria-data" value={data} onChange={setData} />
        </div>
        <div>
          <label className="rotulo" htmlFor="avaria-venc">Vencimento da cobrança</label>
          <DateInput id="avaria-venc" value={vencimento} onChange={setVencimento} />
        </div>
      </div>
      <input
        aria-label="Observações da avaria"
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        className="campo"
        placeholder="Observações (opcional)"
      />
      <p className="text-xs text-cinza">
        {tipo === "dano"
          ? "Dano gera a cobrança, mas a peça continua no acervo."
          : "Quebra e perda geram a cobrança e tiram as peças do acervo."}
      </p>
      <div className="flex gap-2">
        <button onClick={salvar} disabled={enviando || !pecaId} className="btn-primario">
          {enviando ? "Salvando..." : "Registrar avaria"}
        </button>
        <button onClick={() => setAberto(false)} className="btn-contorno">Cancelar</button>
      </div>
    </div>
  );
}
