// Chamada às rotas /api a partir do navegador. Toda resposta é conferida:
// nenhuma tela segue em frente achando que salvou quando o servidor
// recusou (era assim que parcelas se perdiam em silêncio no sistema antigo).

export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: string };

export async function requisitar<T = unknown>(
  url: string,
  metodo: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  corpo?: unknown
): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, {
      method: metodo,
      headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const mensagem =
        json && typeof json === "object" && "error" in json
          ? String((json as { error: unknown }).error)
          : "Não foi possível concluir. Tente novamente.";
      return { ok: false, erro: mensagem };
    }
    return { ok: true, dados: json as T };
  } catch {
    return { ok: false, erro: "Falha de conexão. Confira a internet e tente novamente." };
  }
}
