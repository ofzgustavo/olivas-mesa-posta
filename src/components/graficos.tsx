"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

// Cores dos gráficos. Validadas para daltonismo (protanopia, deuteranopia,
// tritanopia): o verde-oliva é escuro e o âmbar é claro, então as duas
// séries se separam por luminosidade e não só por matiz. O âmbar tem
// contraste baixo contra o branco, por isso todo gráfico com ele tem
// legenda em texto e tooltip com os valores.
const COR_RECEITA = "#456A1A";
const COR_DESPESA = "#D69A2D";
const TINTA_SECUNDARIA = "#6E6A60";
const GRADE = "#EDEAE3";

const moedaCompacta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
});

const eixo = { fontSize: 11, fill: TINTA_SECUNDARIA, fontFamily: "Lato" };

type Entrada = { name?: string; value?: number; color?: string; dataKey?: string | number };

function Dica({
  active,
  payload,
  label,
  formato,
}: {
  active?: boolean;
  payload?: Entrada[];
  label?: string;
  formato: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-black/10 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-tinta mb-1">{label}</p>
      {payload.map((e) => (
        <p key={String(e.dataKey)} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: e.color }} />
          <span className="text-cinza">{e.name}</span>
          <span className="ml-auto pl-3 valor font-medium text-tinta">{formato(Number(e.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

function Legenda({ itens }: { itens: { cor: string; rotulo: string }[] }) {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-cinza">
      {itens.map((i) => (
        <span key={i.rotulo} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: i.cor }} />
          {i.rotulo}
        </span>
      ))}
    </div>
  );
}

export function GraficoReceitaDespesa({
  titulo,
  dados,
}: {
  titulo: string;
  dados: { rotulo: string; receita: number; despesa: number }[];
}) {
  return (
    <div className="cartao">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="font-titulo text-xl text-oliva-escuro">{titulo}</h2>
        <Legenda
          itens={[
            { cor: COR_RECEITA, rotulo: "Receita (recebido)" },
            { cor: COR_DESPESA, rotulo: "Despesa" },
          ]}
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={dados} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis
            dataKey="rotulo"
            tick={eixo}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={eixo}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v: number) => moedaCompacta.format(v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            content={<Dica formato={formatCurrency} />}
          />
          <Bar dataKey="receita" name="Receita" fill={COR_RECEITA} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="despesa" name="Despesa" fill={COR_DESPESA} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficoBarrasHorizontais({
  titulo,
  dados,
  formato = "moeda",
  nomeSerie,
}: {
  titulo: string;
  dados: { rotulo: string; valor: number }[];
  formato?: "moeda" | "numero";
  nomeSerie: string;
}) {
  const fmt = formato === "moeda" ? formatCurrency : (v: number) => v.toLocaleString("pt-BR");
  const altura = Math.max(120, dados.length * 34 + 24);

  return (
    <div className="cartao">
      <h2 className="font-titulo text-xl text-oliva-escuro mb-4">{titulo}</h2>
      {!dados.length ? (
        <p className="text-sm text-cinza">Sem dados ainda.</p>
      ) : (
        <ResponsiveContainer width="100%" height={altura}>
          <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke={GRADE} />
            <XAxis
              type="number"
              tick={eixo}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (formato === "moeda" ? moedaCompacta.format(v) : String(v))}
            />
            <YAxis
              type="category"
              dataKey="rotulo"
              tick={{ ...eixo, fill: "#22221E" }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<Dica formato={fmt} />} />
            <Bar dataKey="valor" name={nomeSerie} fill={COR_RECEITA} radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
