import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasEntre,
  diferencaEmDias,
  fimDoMes,
  formatarData,
  formatarMesAno,
  hoje,
  isDataISO,
  mesesEntre,
  periodosSobrepoem,
  somarDias,
  somarMeses,
} from "./datas.ts";

test("hoje usa o dia de Brasília, não o de UTC", () => {
  // 28/07 às 02:00 UTC ainda é dia 27 no Brasil (UTC-3). Se este teste
  // quebrar, parcela que vence hoje volta a aparecer vencida às 21h.
  assert.equal(hoje(new Date("2026-07-28T02:00:00Z")), "2026-07-27");
  assert.equal(hoje(new Date("2026-07-28T03:00:00Z")), "2026-07-28");
});

test("isDataISO rejeita datas que não existem", () => {
  assert.equal(isDataISO("2026-02-28"), true);
  assert.equal(isDataISO("2028-02-29"), true);
  assert.equal(isDataISO("2026-02-29"), false);
  assert.equal(isDataISO("2026-04-31"), false);
  assert.equal(isDataISO("28/02/2026"), false);
  assert.equal(isDataISO(null), false);
});

test("somarDias atravessa mês e ano", () => {
  assert.equal(somarDias("2026-12-30", 3), "2027-01-02");
  assert.equal(somarDias("2026-03-01", -1), "2026-02-28");
});

test("somarMeses cai no último dia quando o mês é mais curto", () => {
  assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(somarMeses("2028-01-31", 1), "2028-02-29");
  assert.equal(somarMeses("2026-11-15", 2), "2027-01-15");
});

test("fimDoMes e intervalos", () => {
  assert.equal(fimDoMes("2026-02-10"), "2026-02-28");
  assert.equal(fimDoMes("2026-04-01"), "2026-04-30");
  assert.equal(diferencaEmDias("2026-11-10", "2026-11-13"), 3);
  assert.deepEqual(diasEntre("2026-10-30", "2026-11-02"), [
    "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02",
  ]);
  assert.deepEqual(mesesEntre("2026-11-20", "2027-02-01"), [
    "2026-11", "2026-12", "2027-01", "2027-02",
  ]);
});

test("periodosSobrepoem considera os dois extremos", () => {
  assert.equal(periodosSobrepoem("2026-11-10", "2026-11-13", "2026-11-13", "2026-11-16"), true);
  assert.equal(periodosSobrepoem("2026-11-10", "2026-11-13", "2026-11-14", "2026-11-16"), false);
});

test("formatação em português", () => {
  assert.equal(formatarData("2026-08-01"), "01/08/2026");
  assert.equal(formatarData(null), "—");
  assert.equal(formatarMesAno("2026-10"), "outubro de 2026");
});
