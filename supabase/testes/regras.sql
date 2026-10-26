-- =============================================
-- Testes das regras do banco (reserva, avaria, acervo).
--
-- NUNCA rodar no Supabase de produção: o script cria e apaga dados.
-- Roda num PostgreSQL local descartável:
--
--   createdb olivas_teste
--   psql -v ON_ERROR_STOP=1 -d olivas_teste -f supabase/testes/regras.sql
--
-- Sai com erro na primeira regra violada; termina com "TODOS OS TESTES
-- PASSARAM" se tudo estiver certo.
-- =============================================

\set ON_ERROR_STOP 1
SET client_min_messages = warning;

-- Papéis que o Supabase já tem; aqui, criados se faltarem.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

\ir ../schema.sql

SET ROLE authenticated;

-- ---------------------------------------------
-- Estado inicial: 50 taças, 1 cliente
-- ---------------------------------------------
CREATE TEMP TABLE ids (nome TEXT PRIMARY KEY, id UUID);

INSERT INTO ids VALUES
  ('taca', salvar_peca(NULL, '{"nome":"Taça cristal","categoria":"tacas_copos","valor_reposicao":"35"}', 50));
INSERT INTO clientes (nome) VALUES ('Ana') RETURNING id \gset cli_
INSERT INTO ids VALUES ('ana', :'cli_id');

DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 50,
    'estoque inicial deveria ser 50';
END $$;

-- ---------------------------------------------
-- Orçamento não reserva
-- ---------------------------------------------
INSERT INTO ids VALUES ('A', salvar_evento(NULL,
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento A',
    'data_evento','2026-11-10','data_saida','2026-11-10','data_retorno','2026-11-13','valor_total','2000'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 40)),
  '[{"tipo":"sinal","valor":"1000","data_vencimento":"2026-10-15"},
    {"tipo":"saldo","valor":"1000","data_vencimento":"2026-11-10"}]'));

INSERT INTO ids VALUES ('B', salvar_evento(NULL,
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento B',
    'data_evento','2026-11-12','data_saida','2026-11-12','data_retorno','2026-11-15','valor_total','1500'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 30)),
  '[{"tipo":"avista","valor":"1500","data_vencimento":"2026-10-20"}]'));

DO $$
BEGIN
  ASSERT (SELECT COALESCE(SUM(reservado),0) FROM reservas_no_periodo('2026-11-01','2026-11-30')) = 0,
    'orçamento não deveria reservar peça';
  ASSERT (SELECT COUNT(*) FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='A')) = 2,
    'evento A deveria ter 2 parcelas';
END $$;

-- ---------------------------------------------
-- Pagamento confirma o evento e reserva
-- ---------------------------------------------
UPDATE parcelas SET status = 'recebido', data_recebimento = '2026-10-10'
 WHERE evento_id = (SELECT id FROM ids WHERE nome='A') AND tipo = 'sinal';

DO $$
BEGIN
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='A')) = 'confirmado',
    'pagamento deveria confirmar o evento A';
  ASSERT (SELECT disponivel FROM disponibilidade_pecas('2026-11-12','2026-11-15')
           WHERE peca_id = (SELECT id FROM ids WHERE nome='taca')) = 10,
    'deveriam sobrar 10 taças entre 12 e 15/11';
END $$;

-- ---------------------------------------------
-- Reserva duplicada é recusada, e o pagamento não é gravado
-- ---------------------------------------------
DO $$
BEGIN
  BEGIN
    UPDATE parcelas SET status = 'recebido', data_recebimento = '2026-10-11'
     WHERE evento_id = (SELECT id FROM ids WHERE nome='B');
    RAISE EXCEPTION 'deveria ter recusado: 40 + 30 taças > 50';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Peças indisponíveis entre 12/11/2026 e 15/11/2026: Taça cristal (pedido 30, livre 10)%',
      'mensagem inesperada: ' || SQLERRM;
  END;
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='B')) = 'orcamento',
    'evento B deveria continuar orçamento';
  ASSERT (SELECT status FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='B')) = 'pendente',
    'pagamento de B não deveria ter sido gravado';
END $$;

-- Confirmar pela edição do evento também é recusado
DO $$
BEGIN
  BEGIN
    PERFORM salvar_evento((SELECT id FROM ids WHERE nome='B'),
      jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento B',
        'data_evento','2026-11-12','data_saida','2026-11-12','data_retorno','2026-11-15',
        'valor_total','1500','status','confirmado'),
      jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 30)),
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'valor', valor, 'data_vencimento', data_vencimento))
         FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='B')));
    RAISE EXCEPTION 'deveria ter recusado a confirmação manual';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Peças indisponíveis%', 'mensagem inesperada: ' || SQLERRM;
  END;
END $$;

-- ---------------------------------------------
-- Eventos na mesma semana, mas sem dia em comum, não disputam peça
-- ---------------------------------------------
INSERT INTO ids VALUES ('C', salvar_evento(NULL,
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento C',
    'data_evento','2026-11-14','data_saida','2026-11-14','data_retorno','2026-11-17',
    'valor_total','900','status','confirmado'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 50)),
  '[]'));

DO $$
BEGIN
  ASSERT (SELECT reservado FROM disponibilidade_pecas('2026-11-10','2026-11-17')
           WHERE peca_id = (SELECT id FROM ids WHERE nome='taca')) = 50,
    'reservado no período deveria ser o pico diário (50), não a soma (90)';
END $$;

-- C ocupa tudo de 14 a 17. Para B caber, C sai e A diminui para 20.
DELETE FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='C');

SELECT salvar_evento((SELECT id FROM ids WHERE nome='A'),
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento A',
    'data_evento','2026-11-10','data_saida','2026-11-10','data_retorno','2026-11-13',
    'valor_total','2000','status','confirmado'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 20)),
  (SELECT jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'valor', valor, 'data_vencimento', data_vencimento))
     FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='A'))) \gset

UPDATE parcelas SET status = 'recebido', data_recebimento = '2026-10-11'
 WHERE evento_id = (SELECT id FROM ids WHERE nome='B');

DO $$
BEGIN
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='B')) = 'confirmado',
    'com A reduzido, B deveria confirmar';
END $$;

-- ---------------------------------------------
-- Edição do evento: tudo ou nada
-- ---------------------------------------------
DO $$
BEGIN
  BEGIN
    PERFORM salvar_evento((SELECT id FROM ids WHERE nome='A'),
      jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'NOVO TÍTULO',
        'data_evento','2026-11-10','data_saida','2026-11-10','data_retorno','2026-11-13',
        'valor_total','2000','status','confirmado'),
      jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 0)),
      '[]');
    RAISE EXCEPTION 'deveria ter recusado quantidade 0';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  ASSERT (SELECT titulo FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='A')) = 'Evento A',
    'falha no meio não deveria gravar o título novo';
END $$;

-- Parcela já recebida nunca some pela edição
SELECT salvar_evento((SELECT id FROM ids WHERE nome='A'),
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento A',
    'data_evento','2026-11-10','data_saida','2026-11-10','data_retorno','2026-11-13',
    'valor_total','2000','status','confirmado'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 20)),
  '[]') \gset

DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='A')) = 1,
    'deveria sobrar só o sinal recebido';
  ASSERT (SELECT tipo FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='A')) = 'sinal',
    'a parcela que sobra deveria ser o sinal recebido';
END $$;

-- Editar sem mandar "status" mantém o status atual
SELECT salvar_evento((SELECT id FROM ids WHERE nome='A'),
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento A',
    'data_evento','2026-11-10','data_saida','2026-11-10','data_retorno','2026-11-13','valor_total','2000'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 20)),
  (SELECT jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'valor', valor, 'data_vencimento', data_vencimento))
     FROM parcelas WHERE evento_id = (SELECT id FROM ids WHERE nome='A'))) \gset
DO $$
BEGIN
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='A')) = 'confirmado',
    'editar sem status não deveria voltar o evento para orçamento';
END $$;

-- Cancelar libera as peças; reabrir checa de novo
SELECT alterar_status_evento((SELECT id FROM ids WHERE nome='A'), 'cancelado') \gset
INSERT INTO ids VALUES ('D', salvar_evento(NULL,
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento D',
    'data_evento','2026-11-11','data_saida','2026-11-11','data_retorno','2026-11-11',
    'valor_total','100','status','confirmado'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='taca'), 'quantidade', 31)),
  '[]'));
DO $$
BEGIN
  BEGIN
    PERFORM alterar_status_evento((SELECT id FROM ids WHERE nome='A'), 'confirmado');
    RAISE EXCEPTION 'reabrir A deveria falhar: A (20) + D (31) passam de 50 no dia 11';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Peças indisponíveis%', SQLERRM;
  END;
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='A')) = 'cancelado',
    'A deveria continuar cancelado';
END $$;
DELETE FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='D');
SELECT alterar_status_evento((SELECT id FROM ids WHERE nome='A'), 'confirmado') \gset

-- ---------------------------------------------
-- Avaria: cobrança + baixa no acervo
-- ---------------------------------------------
INSERT INTO avarias (evento_id, peca_id, quantidade, tipo, valor, data, vencimento)
VALUES ((SELECT id FROM ids WHERE nome='A'), (SELECT id FROM ids WHERE nome='taca'),
        5, 'quebra', 175, '2026-11-14', '2026-11-30')
RETURNING id \gset av_
INSERT INTO ids VALUES ('av', :'av_id');

DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 45,
    'quebra de 5 deveria baixar o estoque para 45';
  ASSERT (SELECT valor FROM parcelas WHERE avaria_id = (SELECT id FROM ids WHERE nome='av')) = 175,
    'avaria deveria gerar cobrança de 175';
  ASSERT (SELECT status FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='A')) = 'confirmado',
    'cobrança de avaria não muda o status';
END $$;

-- A cobrança da avaria não pode ser apagada nem ter o valor mudado por fora
DO $$
BEGIN
  BEGIN
    DELETE FROM parcelas WHERE avaria_id = (SELECT id FROM ids WHERE nome='av');
    RAISE EXCEPTION 'deveria ter recusado apagar a cobrança da avaria';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Esta cobrança pertence a uma avaria%', SQLERRM;
  END;
  BEGIN
    UPDATE parcelas SET valor = 1 WHERE avaria_id = (SELECT id FROM ids WHERE nome='av');
    RAISE EXCEPTION 'deveria ter recusado mudar o valor';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'Esta cobrança pertence a uma avaria%', SQLERRM;
  END;
END $$;

-- Avaria com cobrança recebida não pode ser apagada
UPDATE parcelas SET status = 'recebido', data_recebimento = '2026-11-20'
 WHERE avaria_id = (SELECT id FROM ids WHERE nome='av');
DO $$
BEGIN
  BEGIN
    DELETE FROM avarias WHERE id = (SELECT id FROM ids WHERE nome='av');
    RAISE EXCEPTION 'deveria ter recusado apagar avaria já paga';
  EXCEPTION WHEN raise_exception THEN
    ASSERT SQLERRM LIKE 'A cobrança desta avaria já foi recebida%', SQLERRM;
  END;
END $$;

-- Desfeito o recebimento, apagar a avaria devolve estoque e some a cobrança
UPDATE parcelas SET status = 'pendente', data_recebimento = NULL
 WHERE avaria_id = (SELECT id FROM ids WHERE nome='av');
DELETE FROM avarias WHERE id = (SELECT id FROM ids WHERE nome='av');
DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 50,
    'apagar a avaria deveria devolver as 5 taças';
  ASSERT NOT EXISTS (SELECT 1 FROM parcelas WHERE tipo = 'avaria'),
    'apagar a avaria deveria apagar a cobrança';
END $$;

-- ---------------------------------------------
-- Compra de peça entra no acervo
-- ---------------------------------------------
INSERT INTO despesas (data, valor, categoria, descricao, peca_id, quantidade_pecas)
VALUES ('2026-10-01', 400, 'aquisicao', 'Taças novas', (SELECT id FROM ids WHERE nome='taca'), 10)
RETURNING id AS desp_id \gset

DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 60,
    'compra de 10 deveria levar o estoque a 60';
END $$;

UPDATE despesas SET quantidade_pecas = 4 WHERE id = :'desp_id';
DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 54,
    'editar a compra para 4 deveria levar o estoque a 54';
END $$;

DELETE FROM despesas WHERE id = :'desp_id';
DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 50,
    'apagar a compra deveria voltar a 50';
END $$;

-- Ajuste manual pelo cadastro da peça vira movimento
SELECT salvar_peca((SELECT id FROM ids WHERE nome='taca'),
  '{"nome":"Taça cristal","categoria":"tacas_copos","valor_reposicao":"35"}', 48) \gset
DO $$
BEGIN
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 48,
    'ajuste manual deveria levar o estoque a 48';
  ASSERT (SELECT COUNT(*) FROM movimentos_acervo WHERE motivo = 'ajuste') = 1,
    'ajuste manual deveria gerar 1 movimento';
END $$;

-- ---------------------------------------------
-- Excluir evento com avaria pendente apaga tudo em cascata
-- ---------------------------------------------
INSERT INTO avarias (evento_id, peca_id, quantidade, tipo, valor, data, vencimento)
VALUES ((SELECT id FROM ids WHERE nome='B'), (SELECT id FROM ids WHERE nome='taca'),
        1, 'dano', 20, '2026-11-16', '2026-11-30');
DELETE FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='B');
DO $$
BEGIN
  ASSERT NOT EXISTS (SELECT 1 FROM avarias), 'avaria deveria sumir com o evento';
  ASSERT (SELECT estoque FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='taca')) = 48,
    'dano não mexe no estoque';
END $$;

-- ---------------------------------------------
-- Documentos: preço por item, frete, desconto e número do evento
-- ---------------------------------------------
INSERT INTO ids VALUES
  ('prato', salvar_peca(NULL, '{"nome":"Prato raso","categoria":"loucas","valor_reposicao":"38","valor_locacao":"1.5"}', 100));
INSERT INTO ids VALUES ('doc', salvar_evento(NULL,
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento Doc',
    'data_evento','2027-01-10','data_saida','2027-01-10','data_retorno','2027-01-13',
    'frete','40','desconto','10','recebe_pecas',' Keila ','valor_total','180'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='prato'),
    'quantidade', 100, 'valor_unitario', 1.5)),
  '[]'));
DO $$
DECLARE
  ev eventos%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='doc');
  ASSERT ev.frete = 40 AND ev.desconto = 10, 'frete e desconto deveriam ser gravados';
  ASSERT ev.recebe_pecas = 'Keila', 'quem recebe deveria ser gravado sem espaços';
  ASSERT ev.numero > (SELECT MAX(numero) FROM eventos WHERE id <> ev.id),
    'evento novo deveria ganhar o próximo número';
  ASSERT (SELECT valor_locacao FROM pecas_estoque WHERE id = (SELECT id FROM ids WHERE nome='prato')) = 1.5,
    'preço de locação deveria aparecer na view do acervo';
  ASSERT (SELECT valor_unitario FROM evento_itens WHERE evento_id = ev.id) = 1.5,
    'preço do item deveria ser gravado';
END $$;

-- Mudar o preço da peça não mexe no preço já combinado no evento; editar
-- o evento grava o preço novo do item.
SELECT salvar_peca((SELECT id FROM ids WHERE nome='prato'),
  '{"nome":"Prato raso","categoria":"loucas","valor_locacao":"2"}', 100);
DO $$
BEGIN
  ASSERT (SELECT valor_unitario FROM evento_itens
           WHERE evento_id = (SELECT id FROM ids WHERE nome='doc')) = 1.5,
    'preço do item não deveria mudar com o preço da peça';
END $$;
SELECT salvar_evento((SELECT id FROM ids WHERE nome='doc'),
  jsonb_build_object('cliente_id', (SELECT id FROM ids WHERE nome='ana'), 'titulo', 'Evento Doc',
    'data_evento','2027-01-10','data_saida','2027-01-10','data_retorno','2027-01-13','valor_total','200'),
  jsonb_build_array(jsonb_build_object('peca_id', (SELECT id FROM ids WHERE nome='prato'),
    'quantidade', 100, 'valor_unitario', 2)),
  '[]');
DO $$
DECLARE
  ev eventos%ROWTYPE;
BEGIN
  SELECT * INTO ev FROM eventos WHERE id = (SELECT id FROM ids WHERE nome='doc');
  ASSERT (SELECT valor_unitario FROM evento_itens WHERE evento_id = ev.id) = 2,
    'editar o evento deveria gravar o preço novo do item';
  ASSERT ev.frete = 0 AND ev.desconto = 0 AND ev.recebe_pecas IS NULL,
    'sem frete/desconto/recebe no payload, os campos deveriam zerar';
END $$;

DO $$
BEGIN
  INSERT INTO evento_itens (evento_id, peca_id, quantidade, valor_unitario)
  VALUES ((SELECT id FROM ids WHERE nome='doc'), (SELECT id FROM ids WHERE nome='taca'), 1, -1);
  RAISE EXCEPTION 'preço negativo deveria ser recusado';
EXCEPTION WHEN check_violation THEN
  NULL;
END $$;

-- ---------------------------------------------
-- Sem login, nada é visível
-- ---------------------------------------------
RESET ROLE;
SET ROLE anon;
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM clientes) = 0, 'anon não deveria ver clientes';
  ASSERT (SELECT COUNT(*) FROM pecas_estoque) = 0, 'anon não deveria ver o acervo';
  BEGIN
    PERFORM disponibilidade_pecas('2026-11-01', '2026-11-02');
    RAISE EXCEPTION 'anon não deveria executar funções';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

\echo 'TODOS OS TESTES PASSARAM'
