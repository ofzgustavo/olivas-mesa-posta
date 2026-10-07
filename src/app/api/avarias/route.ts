import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { data, erro, inteiro, lerJson, mensagemDoBanco, numero, texto, uuid } from "@/lib/api";
import { TIPOS_AVARIA } from "@/types";

export async function POST(request: Request) {
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");

  const avaria = {
    evento_id: uuid(corpo["evento_id"]),
    peca_id: uuid(corpo["peca_id"]),
    quantidade: inteiro(corpo["quantidade"]),
    tipo: texto(corpo["tipo"]),
    valor: numero(corpo["valor"]),
    data: data(corpo["data"]),
    vencimento: data(corpo["vencimento"]),
    observacoes: texto(corpo["observacoes"]),
  };

  if (!avaria.evento_id) return erro("Evento inválido.");
  if (!avaria.peca_id) return erro("Selecione a peça.");
  if (!avaria.quantidade || avaria.quantidade <= 0) return erro("Informe a quantidade.");
  if (!avaria.tipo || !(avaria.tipo in TIPOS_AVARIA)) return erro("Tipo de avaria inválido.");
  if (!avaria.valor || avaria.valor <= 0) return erro("Informe o valor a cobrar do cliente.");
  if (!avaria.data) return erro("Informe a data da avaria.");
  if (!avaria.vencimento) return erro("Informe o vencimento da cobrança.");

  const supabase = await createClient();
  const { data: criada, error } = await supabase.from("avarias").insert(avaria).select().single();
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json(criada, { status: 201 });
}
