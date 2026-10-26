import { Suspense } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { FiltroPeriodo } from "@/components/ui/filtro-periodo";
import { Vazio } from "@/components/ui/vazio";
import { createClient } from "@/lib/supabase/server";
import { carregarAcervo, type PecaComDisponibilidade } from "@/lib/acervo";
import { formatarData, hoje, isDataISO } from "@/lib/datas";
import { cn, formatCurrency } from "@/lib/utils";
import { CATEGORIAS_PECA, type CategoriaPeca } from "@/types";

type SearchParams = { inicio?: string; fim?: string };

export default async function AcervoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const dia = hoje();
  const inicio = isDataISO(params.inicio) ? params.inicio : dia;
  const fim = isDataISO(params.fim) && params.fim >= inicio ? params.fim : inicio;

  const supabase = await createClient();
  const pecas = await carregarAcervo(supabase, inicio, fim);
  const ativas = pecas.filter((p) => p.ativo);
  const inativas = pecas.filter((p) => !p.ativo);

  const porCategoria = new Map<CategoriaPeca, PecaComDisponibilidade[]>();
  for (const p of ativas) {
    porCategoria.set(p.categoria, [...(porCategoria.get(p.categoria) ?? []), p]);
  }
  const totalUnidades = ativas.reduce((s, p) => s + p.estoque, 0);
  const periodo = inicio === fim ? formatarData(inicio) : `${formatarData(inicio)} a ${formatarData(fim)}`;

  return (
    <>
      <Header
        title="Acervo"
        subtitle={`${ativas.length} peças · ${totalUnidades} unidades · disponibilidade em ${periodo}`}
        action={
          <Link href="/acervo/novo" className="btn-primario">
            <Plus className="w-4 h-4" />
            Nova peça
          </Link>
        }
      />

      <div className="cartao mb-4">
        <Suspense>
          <FiltroPeriodo inicio={inicio} fim={fim} rotulo="Disponibilidade de" />
        </Suspense>
        <p className="text-xs text-cinza mt-2">
          Só eventos confirmados ou realizados reservam peças. &ldquo;Reservado&rdquo; é o maior
          volume em uso num mesmo dia do período.
        </p>
      </div>

      {!pecas.length ? (
        <div className="cartao">
          <Vazio icone={Package}>
            Nenhuma peça cadastrada ainda.{" "}
            <Link href="/acervo/novo" className="text-oliva underline">Cadastre a primeira</Link>.
          </Vazio>
        </div>
      ) : (
        <div className="space-y-4">
          {[...porCategoria.entries()].map(([categoria, lista]) => (
            <TabelaPecas key={categoria} titulo={CATEGORIAS_PECA[categoria]} pecas={lista} />
          ))}
          {inativas.length > 0 && <TabelaPecas titulo="Desativadas" pecas={inativas} apagada />}
        </div>
      )}
    </>
  );
}

function TabelaPecas({
  titulo,
  pecas,
  apagada = false,
}: {
  titulo: string;
  pecas: PecaComDisponibilidade[];
  apagada?: boolean;
}) {
  return (
    <div className={cn("cartao", apagada && "opacity-60")}>
      <h2 className="titulo-secao mb-3">{titulo}</h2>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left">
              <th className="titulo-secao pb-2 px-2 font-normal">Peça</th>
              <th className="titulo-secao pb-2 px-2 font-normal text-right">Estoque</th>
              <th className="titulo-secao pb-2 px-2 font-normal text-right">Reservado</th>
              <th className="titulo-secao pb-2 px-2 font-normal text-right">Livre</th>
              <th className="titulo-secao pb-2 px-2 font-normal text-right hidden sm:table-cell">
                Locação (un.)
              </th>
              <th className="titulo-secao pb-2 px-2 font-normal text-right hidden sm:table-cell">
                Reposição (un.)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {pecas.map((p) => (
              <tr key={p.id} className="hover:bg-fundo/60">
                <td className="py-2.5 px-2">
                  <Link href={`/acervo/${p.id}`} className="font-medium hover:text-oliva hover:underline">
                    {p.nome}
                  </Link>
                </td>
                <td className="py-2.5 px-2 text-right valor">{p.estoque}</td>
                <td className="py-2.5 px-2 text-right valor text-cinza">{p.reservado || "—"}</td>
                <td
                  className={cn(
                    "py-2.5 px-2 text-right valor font-bold",
                    p.disponivel < 0 ? "text-red-600" : p.disponivel === 0 ? "text-amber-700" : "text-oliva"
                  )}
                  title={p.disponivel < 0 ? "Há mais reservado do que existe no acervo" : undefined}
                >
                  {p.disponivel}
                </td>
                <td className="py-2.5 px-2 text-right valor text-cinza hidden sm:table-cell">
                  {p.valor_locacao != null ? formatCurrency(p.valor_locacao) : "—"}
                </td>
                <td className="py-2.5 px-2 text-right valor text-cinza hidden sm:table-cell">
                  {p.valor_reposicao != null ? formatCurrency(p.valor_reposicao) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
