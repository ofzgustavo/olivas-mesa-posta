# Olivas Mesa Posta — Sistema de gestão

Eventos, acervo de peças, reservas por data, pagamentos, avarias e despesas
da Olivas Mesa Posta.

Stack: Next.js 15 (App Router) · Supabase (PostgreSQL + Auth) · Tailwind ·
Recharts · deploy na Vercel. Custo previsto: R$ 0 nos planos gratuitos
para o volume de uma usuária.

## O que o sistema faz

| Tela | Para quê |
|---|---|
| **Painel** | Recebido, despesas, resultado, a receber e vencido; gráfico do período; saídas/eventos/retornos dos próximos 14 dias; cobranças dos próximos 30 dias |
| **Agenda** | Calendário do mês com eventos, saída e retorno das peças |
| **Eventos** | Orçamentos e eventos: cliente, datas, peças, valor, condição de pagamento, avarias e resultado |
| **Acervo** | Peças, estoque e quanto está livre em qualquer período; histórico de entradas e saídas de cada peça |
| **Clientes** | Cadastro |
| **Receitas** | O que foi recebido (por período) e tudo o que falta receber |
| **Despesas** | Frete, reposição, tráfego pago, aquisição de peças e outros |
| **Relatórios** | Caixa mês a mês, faturamento por tipo de evento, despesas por categoria, peças mais alugadas, resultado por evento |

## Regras de negócio

Todas moram no banco (`supabase/schema.sql`), não só na tela — nenhum caminho
do app consegue violá-las.

1. **Orçamento não reserva peça.** O evento nasce como orçamento.
2. **O primeiro pagamento confirma o evento** e só então as peças ficam
   reservadas.
3. **Nunca há reserva duplicada.** A peça fica presa da *saída* ao *retorno*
   do evento (padrão: sai no dia do evento e volta 3 dias depois — retorno e
   lavagem; cada evento pode ajustar). Se em algum dia desse período faltar
   peça, o pagamento (ou a confirmação) é recusado com a lista do que falta.
   Dois eventos na mesma semana, mas sem dia em comum, não disputam a peça.
4. **Avaria gera cobrança.** Quebra, dano ou perda viram uma parcela a
   receber no evento; quebra e perda também tiram a peça do acervo.
5. **Estoque é calculado, nunca digitado por cima.** Cadastro, ajuste, compra
   (despesa de aquisição/reposição com a peça marcada) e avaria viram
   movimentos; o estoque é a soma deles.
6. **Salvar um evento é tudo ou nada**: dados, peças e parcelas vão juntos;
   se algo falha, nada é gravado. Parcela já recebida nunca é apagada pela
   edição, e evento com pagamento recebido não pode ser excluído (cancele).

## Colocar no ar (primeira vez)

### 1. Supabase

1. Crie um projeto em <https://supabase.com> (região **South America (São Paulo)**).
2. **SQL Editor** → cole todo o conteúdo de `supabase/schema.sql` → *Run*.
3. **Authentication → Sign In / Providers**: desligue *Allow new users to sign up*
   (só quem você criar entra).
4. **Authentication → Users → Add user**: crie o usuário com e-mail e senha
   de quem vai usar o sistema (marque *Auto Confirm User*).
5. **Project Settings → API**: copie a *Project URL* e a chave *anon public*.

### 2. Vercel

1. *Add New → Project* → importe o repositório `olivas-mesa-posta`.
2. Em *Environment Variables*, preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon public
3. *Deploy*. Pronto: entre com o usuário criado no passo 1.4.

## Desenvolvimento

```bash
cp .env.example .env.local   # preencha com os dados do Supabase
npm install
npm run dev                  # http://localhost:3000
```

Checagens (rode antes de cada commit):

```bash
npm run type-check
npm run lint
npm test                     # datas, parcelas, valores em reais
```

Testes das regras do banco (precisa de um PostgreSQL local descartável —
**nunca** rode no Supabase de produção):

```bash
createdb olivas_teste
psql -v ON_ERROR_STOP=1 -d olivas_teste -f supabase/testes/regras.sql
```

## Estrutura

```
supabase/
  schema.sql            # tabelas, regras (triggers), funções e RLS
  testes/regras.sql     # testes das regras de reserva, avaria e acervo
src/
  app/(app)/            # telas protegidas (painel, agenda, eventos, acervo…)
  app/api/              # rotas: validam a entrada e chamam o banco
  app/login/
  components/           # formulários, gráficos, componentes de tela
  lib/
    datas.ts            # datas sempre no fuso de Brasília (ver comentário)
    parcelas.ts         # gera sinal + saldo, parcelado, à vista
    valores.ts          # lê "1.234,56", "1.000" etc.
    acervo.ts           # acervo + disponibilidade num período
    supabase/paginar.ts # busca paginada (o Supabase corta em 1.000 linhas)
  types/index.ts        # tipos e rótulos em português
```

## Decisões que valem saber

- **Datas sem fuso.** O servidor da Vercel roda em UTC; "hoje" sempre vem de
  `hoje()` em `src/lib/datas.ts`, que usa o fuso de Brasília. Nunca use
  `new Date().toISOString()` para obter a data do dia.
- **Leituras completas são paginadas** (`buscarTodas`): o Supabase devolve no
  máximo 1.000 linhas por consulta, sem avisar.
- **Toda chamada do navegador confere a resposta** (`lib/requisitar.ts`):
  nenhuma tela segue em frente achando que salvou quando o servidor recusou.
- **Cores dos gráficos** (`components/graficos.tsx`) foram validadas para
  daltonismo; a marca (`app/globals.css`) é trocada mudando as variáveis
  `--oliva`, `--areia` etc. O logo é o componente `components/layout/marca.tsx`.
