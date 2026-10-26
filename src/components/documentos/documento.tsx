import { Marca } from "@/components/layout/marca";
import { formatarData } from "@/lib/datas";
import {
  condicaoPagamento,
  numeroDocumento,
  prazoLocacao,
  resumoValores,
  type TipoDocumento,
} from "@/lib/documentos";
import { EMPRESA } from "@/lib/empresa";
import { cn, formatCurrency } from "@/lib/utils";
import type { Cliente, Evento, Parcela } from "@/types";

export interface DadosDocumento {
  evento: Pick<
    Evento,
    | "numero"
    | "titulo"
    | "data_evento"
    | "data_saida"
    | "data_retorno"
    | "local"
    | "recebe_pecas"
    | "frete"
    | "desconto"
    | "valor_total"
  >;
  cliente: Pick<Cliente, "nome" | "telefone" | "email" | "cpf_cnpj" | "endereco"> | null;
  itens: { nome: string; quantidade: number; valor_unitario: number; valor_reposicao: number | null }[];
  parcelas: Pick<Parcela, "tipo" | "valor" | "data_vencimento" | "status" | "data_recebimento">[];
  emitidoEm: string;
}

const LINHA = "________________________";

/** A folha impressa. Na tela, aparece como um papel; na impressão, ocupa a página. */
export function Documento({ tipo, dados }: { tipo: TipoDocumento; dados: DadosDocumento }) {
  return (
    <article
      className="bg-white text-tinta text-[13px] leading-relaxed max-w-[210mm] mx-auto shadow-sm border border-black/5
                 rounded-xl p-6 sm:p-12 print:shadow-none print:border-0 print:rounded-none print:p-0 print:max-w-none"
    >
      {tipo === "orcamento" && <Orcamento dados={dados} />}
      {tipo === "contrato" && <Contrato dados={dados} />}
      {tipo === "recibo" && <Recibo dados={dados} />}
    </article>
  );
}

function Orcamento({ dados }: { dados: DadosDocumento }) {
  const { evento, cliente } = dados;
  return (
    <>
      <Cabecalho rotulo="Orçamento" numero={numeroDocumento(evento.numero)} />
      <Campos
        campos={[
          ["Cliente", cliente?.nome],
          ["Telefone", cliente?.telefone],
          ["Evento", `${evento.titulo} · ${formatarData(evento.data_evento)}`],
          ["Local de entrega", evento.local],
          ["Entrega", formatarData(evento.data_saida)],
          ["Devolução", formatarData(evento.data_retorno)],
          ["Quem recebe", evento.recebe_pecas],
        ]}
      />
      <TabelaItens dados={dados} />
      <Resumo dados={dados} rotuloTotal="Total geral" />
      <p className="mt-6 text-xs text-cinza">Orçamento emitido em {formatarData(dados.emitidoEm)}.</p>
      <Assinaturas
        caixas={[
          { nome: EMPRESA.nome.toUpperCase() },
          { nome: cliente?.nome.toUpperCase() ?? "CLIENTE" },
        ]}
      />
    </>
  );
}

function Contrato({ dados }: { dados: DadosDocumento }) {
  const { evento, cliente } = dados;
  const { total } = resumoValores(valoresDe(dados));
  const clausulas = [
    "É objeto do presente contrato a locação dos bens constantes do rol deste contrato.",
    `O prazo de vigência será de ${prazoLocacao(evento.data_saida, evento.data_retorno)}, iniciando em ${formatarData(evento.data_saida)} e findando em ${formatarData(evento.data_retorno)}.`,
    `A locação terá o valor de ${formatCurrency(total)}, ${condicaoPagamento(dados.parcelas)}.`,
    "Em caso de inadimplência, será cobrada multa de 2%, juros de mora de 1% ao mês e correção monetária.",
    "O locatário deverá conferir os bens no ato da recepção. Após este momento, qualquer dano será de sua responsabilidade, cobrado pelo valor de reposição indicado no rol.",
    "Caso o locatário não devolva os itens na data prevista, pagará multa de 2% do total por dia de atraso.",
    evento.frete > 0
      ? `Taxa de deslocamento e entrega: ${formatCurrency(evento.frete)}.`
      : "Retirada e devolução dos materiais a cargo do locatário.",
    `Para dirimir quaisquer controvérsias, as partes elegem o foro da comarca de ${EMPRESA.foro}.`,
  ];

  return (
    <>
      <Cabecalho rotulo="Contrato de locação" numero={numeroDocumento(evento.numero)} />
      <p className="text-justify">
        Pelo presente contrato, a <strong>LOCADORA {EMPRESA.nome.toUpperCase()}</strong> e o{" "}
        <strong>LOCATÁRIO {cliente?.nome.toUpperCase() ?? LINHA}</strong>
        {cliente?.cpf_cnpj ? `, CPF/CNPJ ${cliente.cpf_cnpj}` : `, CPF/CNPJ ${LINHA}`}
        {cliente?.endereco ? `, residente em ${cliente.endereco}` : ""}, têm entre si justo e
        contratado o seguinte:
      </p>
      <Campos
        campos={[
          ["Evento", `${evento.titulo} · ${formatarData(evento.data_evento)}`],
          ["Local", evento.local],
          ["Início", formatarData(evento.data_saida)],
          ["Devolução", formatarData(evento.data_retorno)],
        ]}
      />
      <TabelaItens dados={dados} comReposicao />
      <Resumo dados={dados} rotuloTotal="Total do contrato" />
      <h2 className="font-corpo text-[11px] font-bold uppercase tracking-[0.2em] text-cinza mt-6 mb-2">
        Condições gerais
      </h2>
      <ol className="space-y-1 text-[12px] text-justify">
        {clausulas.map((c, i) => (
          <li key={i}>
            <strong>CLÁUSULA {i + 1}ª.</strong> {c}
          </li>
        ))}
      </ol>
      {/* data e assinaturas não se separam numa quebra de página */}
      <div className="break-inside-avoid">
        <p className="mt-6 text-xs text-cinza">Emitido em {formatarData(dados.emitidoEm)}.</p>
        <Assinaturas
          caixas={[
            { nome: EMPRESA.nome.toUpperCase(), detalhe: "Locadora" },
            { nome: cliente?.nome.toUpperCase() ?? "LOCATÁRIO", detalhe: "Locatário" },
          ]}
        />
        <Assinaturas
          caixas={[
            { nome: "Testemunha 1", detalhe: "CPF:" },
            { nome: "Testemunha 2", detalhe: "CPF:" },
          ]}
        />
      </div>
    </>
  );
}

function Recibo({ dados }: { dados: DadosDocumento }) {
  const { evento, cliente } = dados;
  const numero = numeroDocumento(evento.numero);
  return (
    <>
      <Cabecalho rotulo="Recibo de entrega" numero={`R${numero}`} />
      <h2 className="text-center font-titulo text-2xl font-semibold text-oliva-escuro tracking-wide">
        Recibo de entrega de materiais
      </h2>
      <p className="text-center text-xs text-cinza mb-2">
        Ref. contrato nº {numero} · Emitido em {formatarData(dados.emitidoEm)}
      </p>
      <Campos
        campos={[
          ["Locatário", cliente?.nome],
          ["CPF/CNPJ", cliente?.cpf_cnpj],
          ["Local do evento", evento.local],
          ["Data do evento", formatarData(evento.data_evento)],
          ["Devolução até", formatarData(evento.data_retorno)],
          ["Recebido por", evento.recebe_pecas],
        ]}
      />
      <p className="text-justify mb-3">
        Pelo presente recibo, o <strong>LOCATÁRIO {cliente?.nome.toUpperCase() ?? LINHA}</strong>{" "}
        declara ter recebido em perfeito estado os seguintes materiais da{" "}
        <strong>{EMPRESA.nome.toUpperCase()}</strong>, conforme listado abaixo:
      </p>
      <TabelaItens dados={dados} rotuloItem="Item recebido" />
      <Resumo dados={dados} rotuloTotal="Valor total da locação" />
      <div className="mt-4 rounded-lg bg-fundo border border-black/10 p-3 text-[12px] text-cinza print:bg-transparent">
        <p className="font-bold text-tinta">Observações importantes:</p>
        <ul className="list-disc pl-5">
          <li>Os materiais foram conferidos e recebidos em perfeito estado pelo locatário.</li>
          <li>
            O locatário se responsabiliza pela guarda e devolução dos materiais até{" "}
            {formatarData(evento.data_retorno)}.
          </li>
          <li>Em caso de danos ou perdas, o valor de reposição será cobrado conforme contrato.</li>
          <li>Dúvidas: {EMPRESA.telefone}</li>
        </ul>
      </div>
      <p className="mt-4 text-center text-xs text-cinza">
        Ao assinar este recibo, o locatário confirma ter recebido os itens acima em perfeito estado
        e está ciente das condições de devolução.
      </p>
      <Assinaturas
        caixas={[
          { nome: EMPRESA.nome.toUpperCase(), detalhe: "Responsável pela entrega" },
          {
            nome: (evento.recebe_pecas ?? cliente?.nome ?? "LOCATÁRIO").toUpperCase(),
            detalhe: "Confirma o recebimento",
          },
        ]}
      />
    </>
  );
}

// ---------------------------------------------------------------------

function valoresDe(dados: DadosDocumento) {
  return {
    itens: dados.itens,
    frete: dados.evento.frete,
    desconto: dados.evento.desconto,
    valor_total: dados.evento.valor_total,
  };
}

function Cabecalho({ rotulo, numero }: { rotulo: string; numero: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-black/15">
      <div>
        <Marca />
        <p className="text-[11px] text-cinza mt-1.5">
          {EMPRESA.telefone} · {EMPRESA.email}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cinza">{rotulo}</p>
        <p className="font-titulo text-2xl font-semibold text-oliva-escuro valor">Nº {numero}</p>
      </div>
    </header>
  );
}

function Campos({ campos }: { campos: [string, string | null | undefined][] }) {
  return (
    <dl className="grid sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1 py-3 mb-3 border-b border-black/10">
      {campos.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex gap-1.5 min-w-0">
          <dt className="text-[10px] uppercase tracking-wider text-cinza pt-0.5 shrink-0">{rotulo}:</dt>
          <dd className="min-w-0">{valor || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function TabelaItens({
  dados,
  comReposicao = false,
  rotuloItem = "Item",
}: {
  dados: DadosDocumento;
  comReposicao?: boolean;
  rotuloItem?: string;
}) {
  const { comPrecos } = resumoValores(valoresDe(dados));
  const th = "bg-oliva text-white font-bold text-[10px] uppercase tracking-wider px-2 py-1.5";
  return (
    <table className="w-full text-[12px] border-collapse">
      <thead>
        <tr>
          <th className={cn(th, "text-center w-14")}>Qtd</th>
          <th className={cn(th, "text-left")}>{rotuloItem}</th>
          {comPrecos && <th className={cn(th, "text-right")}>Unit.</th>}
          {comReposicao && <th className={cn(th, "text-right")}>Reposição</th>}
          {comPrecos && <th className={cn(th, "text-right")}>Total</th>}
        </tr>
      </thead>
      <tbody>
        {dados.itens.map((i, idx) => (
          <tr key={idx} className={cn("border-b border-black/5", idx % 2 === 0 && "bg-fundo/60")}>
            <td className="px-2 py-1 text-center valor">{i.quantidade}</td>
            <td className="px-2 py-1">{i.nome}</td>
            {comPrecos && <td className="px-2 py-1 text-right valor">{formatCurrency(i.valor_unitario)}</td>}
            {comReposicao && (
              <td className="px-2 py-1 text-right valor">
                {i.valor_reposicao != null ? formatCurrency(i.valor_reposicao) : "—"}
              </td>
            )}
            {comPrecos && (
              <td className="px-2 py-1 text-right valor">{formatCurrency(i.quantidade * i.valor_unitario)}</td>
            )}
          </tr>
        ))}
        {!dados.itens.length && (
          <tr>
            <td colSpan={5} className="px-2 py-3 text-center text-cinza">
              Nenhuma peça escolhida neste evento.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function Resumo({ dados, rotuloTotal }: { dados: DadosDocumento; rotuloTotal: string }) {
  const { linhas, total } = resumoValores(valoresDe(dados));
  return (
    <dl className="ml-auto mt-3 w-full sm:w-80 print:w-80 text-[12px]">
      {linhas.map((l) => (
        <div
          key={l.rotulo}
          className={cn("flex justify-between py-1 border-b border-black/5", l.valor < 0 && "text-red-700")}
        >
          <dt>{l.rotulo}</dt>
          <dd className="valor">
            {l.valor < 0 ? `− ${formatCurrency(-l.valor)}` : formatCurrency(l.valor)}
          </dd>
        </div>
      ))}
      <div className="flex justify-between pt-2 text-[14px] font-bold text-oliva-escuro uppercase">
        <dt>{rotuloTotal}</dt>
        <dd className="valor">{formatCurrency(total)}</dd>
      </div>
    </dl>
  );
}

function Assinaturas({ caixas }: { caixas: { nome: string; detalhe?: string }[] }) {
  return (
    <div className="flex gap-10 mt-12 print:mt-9 break-inside-avoid">
      {caixas.map((c) => (
        <div key={c.nome} className="flex-1 text-center text-[11px]">
          <div className="border-t border-tinta mb-1.5" />
          <p className="font-bold">{c.nome}</p>
          {c.detalhe && <p className="text-cinza">{c.detalhe}</p>}
        </div>
      ))}
    </div>
  );
}
