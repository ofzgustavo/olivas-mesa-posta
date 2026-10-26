import { test } from "node:test";
import assert from "node:assert/strict";
import {
  condicaoPagamento,
  numeroDocumento,
  porExtenso,
  prazoLocacao,
  resumoValores,
  valorSugerido,
} from "./documentos.ts";

const itens = [
  { quantidade: 100, valor_unitario: 1.5 },
  { quantidade: 3, valor_unitario: 0.1 }, // 0,30 sem erro de ponto flutuante
];

test("valor sugerido é itens + frete − desconto, nunca negativo", () => {
  assert.equal(valorSugerido(itens, 40, 10), 180.3);
  assert.equal(valorSugerido([], 0, 50), 0);
});

test("resumo com preço por item fecha no valor do evento", () => {
  const r = resumoValores({ itens, frete: 40, desconto: 10, valor_total: 180.3 });
  assert.equal(r.total, 180.3);
  assert.equal(r.comPrecos, true);
  assert.deepEqual(r.linhas, [
    { rotulo: "Subtotal dos itens", valor: 150.3 },
    { rotulo: "Frete", valor: 40 },
    { rotulo: "Desconto", valor: -10 },
  ]);
});

test("valor do evento acima da soma aparece como montagem; abaixo, como desconto", () => {
  const acima = resumoValores({ itens, frete: 0, desconto: 0, valor_total: 300 });
  assert.deepEqual(acima.linhas.at(-1), { rotulo: "Montagem e serviços", valor: 149.7 });
  const abaixo = resumoValores({ itens, frete: 0, desconto: 0, valor_total: 150 });
  assert.deepEqual(abaixo.linhas.at(-1), { rotulo: "Desconto adicional", valor: -0.3 });
  for (const r of [acima, abaixo]) {
    const soma = Math.round(r.linhas.reduce((s, l) => s + l.valor, 0) * 100) / 100;
    assert.equal(soma, r.total);
  }
});

test("evento sem preço por item mostra a locação numa linha só", () => {
  const r = resumoValores({
    itens: [{ quantidade: 50, valor_unitario: 0 }],
    frete: 40,
    desconto: 0,
    valor_total: 1000,
  });
  assert.equal(r.comPrecos, false);
  assert.deepEqual(r.linhas, [
    { rotulo: "Locação dos itens", valor: 960 },
    { rotulo: "Frete", valor: 40 },
  ]);
});

test("prazo da locação por extenso, da saída ao retorno", () => {
  assert.equal(prazoLocacao("2026-11-10", "2026-11-13"), "03 (três) dias");
  assert.equal(prazoLocacao("2026-11-10", "2026-11-10"), "01 (um) dia");
  assert.equal(prazoLocacao("2026-11-28", "2026-12-19"), "21 (vinte e um) dias");
  assert.equal(porExtenso(40), "quarenta");
  assert.equal(porExtenso(150), "150");
});

test("número do documento tem quatro dígitos", () => {
  assert.equal(numeroDocumento(7), "0007");
  assert.equal(numeroDocumento(12345), "12345");
});

test("condição de pagamento vem das parcelas, sem as de avaria", () => {
  assert.equal(
    condicaoPagamento([]),
    "devendo ser integralmente pago até a data de início da locação"
  );
  const texto = condicaoPagamento([
    { tipo: "saldo", valor: 500, data_vencimento: "2026-11-10", status: "pendente", data_recebimento: null },
    { tipo: "avaria", valor: 38, data_vencimento: "2026-11-20", status: "pendente", data_recebimento: null },
    { tipo: "sinal", valor: 500, data_vencimento: "2026-10-15", status: "recebido", data_recebimento: "2026-10-14" },
  ]);
  assert.equal(
    texto.replace(/ /g, " "),
    "pago da seguinte forma: sinal de R$ 500,00, pago em 14/10/2026; saldo de R$ 500,00, até 10/11/2026"
  );
});

test("parcelas numeradas quando há mais de uma", () => {
  const texto = condicaoPagamento([
    { tipo: "parcela", valor: 100, data_vencimento: "2026-11-01", status: "pendente", data_recebimento: null },
    { tipo: "parcela", valor: 100, data_vencimento: "2026-12-01", status: "pendente", data_recebimento: null },
  ]);
  assert.match(texto, /1ª parcela de .*; 2ª parcela de /);
});
