import { inteiro, numero, texto } from "@/lib/api";
import { CATEGORIAS_PECA, type CategoriaPeca } from "@/types";

type Lido =
  | { ok: false; erro: string }
  | { ok: true; dados: Record<string, unknown>; quantidade: number };

export function lerPeca(corpo: Record<string, unknown>): Lido {
  const categoria = texto(corpo["categoria"]);
  const valor = numero(corpo["valor_reposicao"]);
  const locacao = numero(corpo["valor_locacao"]);
  const quantidade = inteiro(corpo["quantidade"]);

  if (!texto(corpo["nome"])) return { ok: false, erro: "Informe o nome da peça." };
  if (!categoria || !(categoria in CATEGORIAS_PECA)) return { ok: false, erro: "Categoria inválida." };
  if (valor != null && valor < 0) return { ok: false, erro: "Valor de reposição inválido." };
  if (locacao != null && locacao < 0) return { ok: false, erro: "Preço de locação inválido." };
  if (quantidade == null || quantidade < 0) return { ok: false, erro: "Informe a quantidade (0 ou mais)." };

  return {
    ok: true,
    dados: {
      nome: texto(corpo["nome"]),
      categoria: categoria as CategoriaPeca,
      valor_reposicao: valor,
      valor_locacao: locacao,
      observacoes: texto(corpo["observacoes"]),
      ...(typeof corpo["ativo"] === "boolean" ? { ativo: corpo["ativo"] } : {}),
    },
    quantidade,
  };
}
