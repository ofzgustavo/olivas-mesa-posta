import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ActionButtons } from "@/components/ui/action-buttons";
import { Vazio } from "@/components/ui/vazio";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/paginar";
import { formatarData } from "@/lib/datas";

export default async function ClientesPage() {
  const supabase = await createClient();
  const clientes = await buscarTodas((de, ate) =>
    supabase
      .from("clientes")
      .select("id, nome, telefone, email, eventos(id, data_evento)")
      .order("nome")
      .order("id")
      .range(de, ate)
  );

  return (
    <>
      <Header
        title="Clientes"
        subtitle={`${clientes.length} cadastrado${clientes.length === 1 ? "" : "s"}`}
        action={
          <Link href="/clientes/novo" className="btn-primario">
            <Plus className="w-4 h-4" />
            Novo cliente
          </Link>
        }
      />

      <div className="cartao">
        {!clientes.length ? (
          <Vazio icone={Users}>Nenhum cliente cadastrado ainda.</Vazio>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 text-left">
                  <th className="titulo-secao pb-3 px-2">Nome</th>
                  <th className="titulo-secao pb-3 px-2">Contato</th>
                  <th className="titulo-secao pb-3 px-2">Eventos</th>
                  <th className="titulo-secao pb-3 px-2">Último evento</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {clientes.map((cliente) => {
                  const datas = cliente.eventos.map((e) => e.data_evento).sort();
                  return (
                    <tr key={cliente.id} className="hover:bg-fundo/60">
                      <td className="py-3 px-2 font-medium">{cliente.nome}</td>
                      <td className="py-3 px-2 text-cinza">
                        {[cliente.telefone, cliente.email].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-3 px-2 text-cinza">{cliente.eventos.length}</td>
                      <td className="py-3 px-2 text-cinza">{formatarData(datas.at(-1))}</td>
                      <td className="py-3 px-2">
                        <ActionButtons
                          editHref={`/clientes/${cliente.id}/editar`}
                          deleteUrl={`/api/clientes/${cliente.id}`}
                          deleteConfirmMessage={`Excluir o cliente "${cliente.nome}"?`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
