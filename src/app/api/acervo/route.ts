import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { data, erro, lerJson, mensagemDoBanco, uuid } from "@/lib/api";
import { carregarAcervo } from "@/lib/acervo";
import { lerPeca } from "./campos";

// Acervo com disponibilidade num período: ?inicio=YYYY-MM-DD&fim=...&ignorar=<evento>
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const inicio = data(q.get("inicio"));
  const fim = data(q.get("fim"));
  if (!inicio || !fim || inicio > fim) return erro("Período inválido.");

  const supabase = await createClient();
  try {
    return NextResponse.json(await carregarAcervo(supabase, inicio, fim, uuid(q.get("ignorar"))));
  } catch {
    return erro("Não foi possível carregar o acervo.", 500);
  }
}

export async function POST(request: Request) {
  const corpo = await lerJson(request);
  if (!corpo) return erro("Dados inválidos.");
  const peca = lerPeca(corpo);
  if (!peca.ok) return erro(peca.erro);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("salvar_peca", {
    p_id: null,
    p_dados: peca.dados,
    p_quantidade: peca.quantidade,
  });
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json({ id }, { status: 201 });
}
