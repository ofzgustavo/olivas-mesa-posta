import { data, inteiro, numero, texto, uuid } from "@/lib/api";
import { CATEGORIAS_COM_PECA, CATEGORIAS_DESPESA, type CategoriaDespesa } from "@/types";

type Lido =
  | { ok: false; erro: string }
  | {
      ok: true;
      despesa: {
        data: string;
        valor: number;
        categoria: CategoriaDespesa;
        descricao: string;
        evento_id: string | null;
        peca_id: string | null;
        quantidade_pecas: number | null;
      };
    };

export function lerDespesa(corpo: Record<string, unknown>): Lido {
  const dia = data(corpo["data"]);
  const valor = numero(corpo["valor"]);
  const categoria = texto(corpo["categoria"]);
  const descricao = texto(corpo["descricao"]);
  const eventoBruto = texto(corpo["evento_id"]);
  const pecaBruta = texto(corpo["peca_id"]);
  const evento_id = eventoBruto ? uuid(eventoBruto) : null;
  const peca_id = pecaBruta ? uuid(pecaBruta) : null;
  const quantidade = peca_id ? inteiro(corpo["quantidade_pecas"]) : null;

  if (!dia) return { ok: false, erro: "Informe a data." };
  if (valor == null || valor <= 0) return { ok: false, erro: "Informe um valor maior que zero." };
  if (!categoria || !(categoria in CATEGORIAS_DESPESA)) return { ok: false, erro: "Categoria inválida." };
  if (!descricao) return { ok: false, erro: "Descreva a despesa." };
  if (eventoBruto && !evento_id) return { ok: false, erro: "Evento inválido." };
  if (pecaBruta && !peca_id) return { ok: false, erro: "Peça inválida." };
  if (peca_id && !CATEGORIAS_COM_PECA.includes(categoria as CategoriaDespesa)) {
    return { ok: false, erro: "Só despesas de aquisição ou reposição colocam peças no acervo." };
  }
  if (peca_id && (quantidade == null || quantidade <= 0)) {
    return { ok: false, erro: "Informe quantas peças entraram no acervo." };
  }

  return {
    ok: true,
    despesa: {
      data: dia,
      valor: Math.round(valor * 100) / 100,
      categoria: categoria as CategoriaDespesa,
      descricao,
      evento_id,
      peca_id,
      quantidade_pecas: peca_id ? quantidade : null,
    },
  };
}
