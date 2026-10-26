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
| **Eventos** | Orçamentos e eventos: cliente, datas, peças com preço por item, frete, desconto, valor, condição de pagamento, avarias e resultado |
| **Documentos** | Orçamento, contrato de locação e recibo de entrega de cada evento, prontos para imprimir ou salvar em PDF |
| **Acervo** | Peças, preço de locação e de reposição, estoque e quanto está livre em qualquer período; histórico de entradas e saídas de cada peça |
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
6. *(Opcional)* **SQL Editor** → rode `supabase/catalogo-inicial.sql` para
   trazer as 25 peças do catálogo antigo com os preços (estoque entra
   zerado: informe a quantidade de cada peça no Acervo).

### 2. Vercel

1. *Add New → Project* → importe o repositório `olivas-mesa-posta`.
2. Em *Environment Variables*, preencha:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = chave anon public
3. *Deploy*. Pronto: entre com o usuário criado no passo 1.4.

## Atualizar um banco que já está no ar

Mudanças de schema vêm como arquivos `supabase/migracao-*.sql`. Rode no
**SQL Editor** do Supabase, em ordem de data, as que ainda não rodaram
(todas podem ser rodadas de novo sem estragar nada):

| Arquivo | O que traz |
|---|---|
| `migracao-2026-10-documentos.sql` | Preço de locação da peça, preço por item do evento, frete, desconto, "quem recebe" e número do evento (usado nos documentos) |

Rode a migração **antes** de publicar o código que depende dela.

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
npm test                     # datas, parcelas, valores em reais, documentos
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
  migracao-*.sql        # mudanças para o banco que já está no ar
  catalogo-inicial.sql  # opcional: peças e preços do catálogo antigo
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
    documentos.ts       # totais, prazo e pagamento do orçamento/contrato/recibo
    empresa.ts          # telefone, e-mail e foro impressos nos documentos
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
- **Documentos saem do evento, não são guardados à parte.** Orçamento,
  contrato e recibo são montados na hora a partir do evento (número,
  cliente, peças, preços e parcelas); corrigir o evento corrige os
  documentos. O preço de cada peça fica gravado no evento, então mudar o
  preço no acervo não altera orçamento já feito. Se o valor do evento for
  diferente de itens + frete − desconto, a diferença sai no documento como
  "montagem e serviços" (ou "desconto adicional"), para a conta fechar.
