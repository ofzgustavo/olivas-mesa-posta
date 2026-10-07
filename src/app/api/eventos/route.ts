import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerEvento } from "@/lib/evento-payload";

export async function POST(request: Request) {
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const lido = lerEvento(corpo);
  if (!lido.ok) return erro(lido.erro);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("salvar_evento", {
    p_id: null,
    p_dados: lido.payload.dados,
    p_itens: lido.payload.itens,
    p_parcelas: lido.payload.parcelas,
  });
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json({ id }, { status: 201 });
}
