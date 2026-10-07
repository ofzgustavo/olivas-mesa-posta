import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerCliente } from "../campos";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");

  const cliente = lerCliente(corpo);
  if (!cliente.nome) return erro("Informe o nome do cliente.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .update(cliente)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return erro(mensagemDoBanco(error));
  if (!data) return erro("Cliente não encontrado.", 404);
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) {
    return erro(
      error.code === "23503"
        ? "Este cliente tem eventos cadastrados. Exclua ou transfira os eventos antes."
        : mensagemDoBanco(error)
    );
  }
  return new NextResponse(null, { status: 204 });
}
