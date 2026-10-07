// Leitura de valores em reais digitados pela usuária. Puro, para teste
// direto no `node --test`.

/**
 * Entende o jeito brasileiro de digitar dinheiro:
 *   "1.234,56" → 1234.56     "1234,56" → 1234.56
 *   "1.000"    → 1000        "R$ 2.500" → 2500
 *   "1234.56"  → 1234.56 (ponto como decimal, só quando não parece milhar)
 * Devolve NaN quando não dá para entender.
 */
export function parseValor(texto: string): number {
  const limpo = texto.trim().replace(/\s|R\$/g, "");
  if (!limpo) return NaN;

  let normalizado: string;
  if (limpo.includes(",")) {
    // vírgula é o decimal; pontos são milhar
    if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(limpo)) return NaN;
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) {
    // "1.000" ou "12.500.000": no Brasil, isso é milhar
    normalizado = limpo.replace(/\./g, "");
  } else {
    normalizado = limpo;
  }
  return /^-?\d+(\.\d+)?$/.test(normalizado) ? Number(normalizado) : NaN;
}
