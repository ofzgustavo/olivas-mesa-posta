import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerEvento } from "@/lib/evento-payload";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const lido = lerEvento(corpo);
  if (!lido.ok) return erro(lido.erro);

  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_evento", {
    p_id: id,
    p_dados: lido.payload.dados,
    p_itens: lido.payload.itens,
    p_parcelas: lido.payload.parcelas,
  });
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json({ id });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  // Evento com pagamento recebido não se apaga: o dinheiro sumiria das
  // receitas. Nesse caso o caminho é cancelar.
  const { count, error: errCount } = await supabase
    .from("parcelas")
    .select("id", { count: "exact", head: true })
    .eq("evento_id", id)
    .eq("status", "recebido");
  if (errCount) return erro(mensagemDoBanco(errCount));
  if (count) {
    return erro("Este evento já tem pagamento recebido. Cancele o evento em vez de excluí-lo.");
  }

  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) return erro(mensagemDoBanco(error));
  return new NextResponse(null, { status: 204 });
}
