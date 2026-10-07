import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { createClient } from "@/lib/supabase/server";
import type { Cliente } from "@/types";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  return (
    <>
      <Header title="Editar cliente" />
      <ClienteForm cliente={data as Cliente} />
    </>
  );
}
