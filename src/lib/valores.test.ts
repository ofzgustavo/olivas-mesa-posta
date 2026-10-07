import { test } from "node:test";
import assert from "node:assert/strict";
import { parseValor } from "./valores.ts";

test("parseValor entende dinheiro digitado no padrão brasileiro", () => {
  assert.equal(parseValor("1.234,56"), 1234.56);
  assert.equal(parseValor("1234,56"), 1234.56);
  assert.equal(parseValor("5.000,00"), 5000);
  assert.equal(parseValor("R$ 2.500"), 2500);
  assert.equal(parseValor("35"), 35);
  assert.equal(parseValor("0,5"), 0.5);
});

test("ponto sozinho com 3 casas é milhar, não decimal", () => {
  // "1.000" virava R$ 1,00 — erro de mil vezes no valor do evento.
  assert.equal(parseValor("1.000"), 1000);
  assert.equal(parseValor("12.500.000"), 12500000);
});

test("ponto como decimal ainda funciona quando não parece milhar", () => {
  assert.equal(parseValor("1234.56"), 1234.56);
  assert.equal(parseValor("10.5"), 10.5);
});

test("texto que não é número vira NaN", () => {
  assert.ok(Number.isNaN(parseValor("")));
  assert.ok(Number.isNaN(parseValor("abc")));
  assert.ok(Number.isNaN(parseValor("1,2,3")));
  assert.ok(Number.isNaN(parseValor("1.23,4.5")));
});
