import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erro, mensagemDoBanco } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { error } = await supabase.from("avarias").delete().eq("id", id);
  if (error) return erro(mensagemDoBanco(error));
  return new NextResponse(null, { status: 204 });
}
