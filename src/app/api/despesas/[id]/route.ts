import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerDespesa } from "../campos";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const lido = lerDespesa(corpo);
  if (!lido.ok) return erro(lido.erro);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("despesas")
    .update(lido.despesa)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return erro(mensagemDoBanco(error));
  if (!data) return erro("Despesa não encontrada.", 404);
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("despesas").delete().eq("id", id);
  if (error) return erro(mensagemDoBanco(error));
  return new NextResponse(null, { status: 204 });
}
