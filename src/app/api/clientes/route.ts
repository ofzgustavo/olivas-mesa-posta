import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { lerCliente } from "./campos";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").select("*").order("nome");
  if (error) return erro(mensagemDoBanco(error), 500);
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");

  const cliente = lerCliente(corpo);
  if (!cliente.nome) return erro("Informe o nome do cliente.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("clientes").insert(cliente).select().single();
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json(data, { status: 201 });
}
