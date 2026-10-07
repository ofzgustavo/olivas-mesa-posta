import { texto } from "@/lib/api";

export function lerCliente(corpo: Record<string, unknown>) {
  return {
    nome: texto(corpo["nome"]),
    telefone: texto(corpo["telefone"]),
    email: texto(corpo["email"]),
    cpf_cnpj: texto(corpo["cpf_cnpj"]),
    endereco: texto(corpo["endereco"]),
    observacoes: texto(corpo["observacoes"]),
  };
}
