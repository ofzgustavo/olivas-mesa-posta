# Olivas Mesa Posta — instruções para o Claude

Sistema de gestão de uma empresa de locação e montagem de mesas postas.
Interface, código, comentários e mensagens de commit em **português**.

## Antes de concluir qualquer mudança

```bash
npm run type-check && npm run lint && npm test
```

Mudou `supabase/schema.sql`? Rode também os testes do banco num PostgreSQL
local descartável (veja o README) e acrescente um caso em
`supabase/testes/regras.sql` para a regra nova. Mudança de schema num banco
que já está em produção vai como arquivo novo em `supabase/` (migração
idempotente), nunca editando o schema e esperando que alguém rode de novo.

## Convenções

- **Regra de negócio mora no banco** (trigger, constraint ou função), e a
  API só valida formato e traduz mensagens. Reserva de peças, avaria →
  cobrança e estoque por movimentos são as principais — veja o topo de
  `supabase/schema.sql`.
- **Datas**: sempre strings `YYYY-MM-DD` e `hoje()` de `src/lib/datas.ts`.
  Nunca `new Date().toISOString()` nem `format(new Date())` para "hoje".
- **Dinheiro digitado**: `parseValor` (`src/lib/valores.ts`). "1.000" é mil.
- **Consultas que leem "tudo"** passam por `buscarTodas` com `.order(...)`
  terminando em `id` (paginação estável).
- **Chamadas do navegador** usam `requisitar` e tratam `ok: false`.
- **Escrita com várias tabelas** vai numa função do banco (RPC), como
  `salvar_evento`, para ser tudo ou nada.
- Classes de estilo da marca: `cartao`, `campo`, `rotulo`, `btn-primario`,
  `btn-contorno`, `titulo-secao`, `selo`, `valor`; cores `oliva`, `areia`,
  `fundo`, `cinza`, `tinta`.
