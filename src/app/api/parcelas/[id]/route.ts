import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { data, erro, lerJson, mensagemDoBanco } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

// { "acao": "receber", "data_recebimento": "YYYY-MM-DD" } ou { "acao": "desfazer" }
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");

  let mudanca: { status: "recebido" | "pendente"; data_recebimento: string | null };
  if (corpo["acao"] === "receber") {
    const quando = data(corpo["data_recebimento"]);
    if (!quando) return erro("Informe a data do recebimento.");
    mudanca = { status: "recebido", data_recebimento: quando };
  } else if (corpo["acao"] === "desfazer") {
    mudanca = { status: "pendente", data_recebimento: null };
  } else {
    return erro("Ação inválida.");
  }

  const supabase = await createClient();
  const { data: parcela, error } = await supabase
    .from("parcelas")
    .update(mudanca)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return erro(mensagemDoBanco(error));
  if (!parcela) return erro("Parcela não encontrada.", 404);
  return NextResponse.json(parcela);
}
