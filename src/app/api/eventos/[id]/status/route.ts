import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, lerJson, mensagemDoBanco } from "@/lib/api";
import { STATUS_EVENTO, type StatusEvento } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const corpo = await lerJson(request);
  const status = corpo?.["status"];
  if (typeof status !== "string" || !(status in STATUS_EVENTO)) return erro("Status inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("alterar_status_evento", {
    p_id: id,
    p_status: status as StatusEvento,
  });
  if (error) return erro(mensagemDoBanco(error));
  return NextResponse.json({ id, status });
}
