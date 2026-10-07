import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerPeca } from "../campos";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const peca = lerPeca(corpo);
  if (!peca.ok) return erro(peca.erro);

  const supabase = await createClient();
  const { error } = await supabase.rpc("salvar_peca", {
    p_id: id,
    p_dados: peca.dados,
    p_quantidade: peca.quantidade,
  });
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json({ id });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("pecas").delete().eq("id", id);
  if (error) {
    return erro(
      error.code === "23503"
        ? "Esta peça já foi usada em eventos, avarias ou despesas. Em vez de excluir, edite e desative-a."
        : mensagemDoBanco(error)
    );
  }
  return new NextResponse(null, { status: 204 });
}
