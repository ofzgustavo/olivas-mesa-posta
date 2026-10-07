import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerDespesa } from "./campos";

export async function POST(request: Request) {
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const lido = lerDespesa(corpo);
  if (!lido.ok) return erro(lido.erro);

  const supabase = await createClient();
  const { data, error } = await supabase.from("despesas").insert(lido.despesa).select().single();
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json(data, { status: 201 });
}
