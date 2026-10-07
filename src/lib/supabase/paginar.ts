// O Supabase (PostgREST) devolve no máximo 1.000 linhas por consulta, sem
// avisar que cortou. Para totais de receita/despesa isso seria um erro
// silencioso que cresce com o tempo, então toda leitura "de tudo" passa
// por aqui e busca página por página.

const TAMANHO_PAGINA = 1000;

type Resposta<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function buscarTodas<T>(
  consulta: (de: number, ate: number) => Resposta<T>
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = data ?? [];
    todas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) return todas;
  }
}
