import { test } from "node:test";
import assert from "node:assert/strict";
import { dividirValor, gerarParcelas, somaParcelas } from "./parcelas.ts";

test("dividirValor sempre fecha o total, com o centavo extra na primeira", () => {
  assert.deepEqual(dividirValor(1000, 3), [333.34, 333.33, 333.33]);
  assert.equal(somaParcelas(dividirValor(1000, 3).map((valor) => ({ valor }))), 1000);
  assert.deepEqual(dividirValor(10, 1), [10]);
});

test("à vista gera uma parcela", () => {
  assert.deepEqual(gerarParcelas(2500, { forma: "avista", vencimento: "2026-11-01" }), [
    { tipo: "avista", valor: 2500, data_vencimento: "2026-11-01" },
  ]);
});

test("sinal + saldo respeita o percentual e soma o total", () => {
  const parcelas = gerarParcelas(3333.33, {
    forma: "sinal_saldo",
    percentualSinal: 30,
    vencimentoSinal: "2026-10-10",
    vencimentoSaldo: "2026-11-10",
  });
  assert.equal(parcelas.length, 2);
  assert.equal(parcelas[0]?.tipo, "sinal");
  assert.equal(parcelas[0]?.valor, 1000);
  assert.equal(parcelas[1]?.tipo, "saldo");
  assert.equal(somaParcelas(parcelas), 3333.33);
});

test("sinal de 100% vira só o sinal", () => {
  const parcelas = gerarParcelas(800, {
    forma: "sinal_saldo",
    percentualSinal: 100,
    vencimentoSinal: "2026-10-10",
    vencimentoSaldo: "2026-11-10",
  });
  assert.deepEqual(parcelas.map((p) => p.tipo), ["sinal"]);
});

test("parcelado gera vencimentos mensais", () => {
  const parcelas = gerarParcelas(900, { forma: "parcelado", vezes: 3, primeiroVencimento: "2026-01-31" });
  assert.deepEqual(parcelas.map((p) => p.data_vencimento), ["2026-01-31", "2026-02-28", "2026-03-31"]);
  assert.deepEqual(parcelas.map((p) => p.valor), [300, 300, 300]);
});

test("total zero não gera parcela", () => {
  assert.deepEqual(gerarParcelas(0, { forma: "avista", vencimento: "2026-11-01" }), []);
});
