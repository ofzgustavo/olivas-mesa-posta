-- =============================================
-- Catálogo inicial — opcional
--
-- As 25 peças do catálogo do app antigo de orçamentos, com preço de
-- locação e de reposição. Rodar no SQL Editor do Supabase DEPOIS do
-- schema (ou da migração 2026-10). Pode rodar de novo sem duplicar.
--
-- * Peça nova entra com estoque 0: informe a quantidade em Acervo →
--   peça → Editar. Sem estoque, o sistema não confirma eventos com ela.
-- * Peça que já existe com o mesmo nome não é duplicada; só ganha os
--   preços que ainda estiverem em branco.
-- =============================================

INSERT INTO pecas (nome, categoria, valor_locacao, valor_reposicao)
VALUES
  ('Prato Jantar',                      'loucas',      1.50,  38.00),
  ('Prato Sobremesa',                   'loucas',      2.00,  34.00),
  ('Garfo',                             'talheres',    2.00,  30.00),
  ('Faca',                              'talheres',    2.00,  30.00),
  ('Colher de Sobremesa',               'talheres',    1.50,  22.00),
  ('Sousplat Inox',                     'sousplats',   3.50,  40.00),
  ('Sousplat Rattan',                   'sousplats',   4.00,  35.00),
  ('Jogo Americano de Linho Português', 'toalhas',    10.00,  65.00),
  ('Guardanapo de Tecido',              'guardanapos', 3.00,  30.00),
  ('Guardanapo Ponto Ajuor',            'guardanapos', 3.00,  35.00),
  ('Guardanapo Filetado em Prata',      'guardanapos', 5.00,  35.00),
  ('Taça Hannover',                     'tacas_copos', 2.00,  27.00),
  ('Taça Cristal Bohemia Espumante',    'tacas_copos', 4.00,  40.00),
  ('Copo',                              'tacas_copos', 1.50,  25.00),
  ('Travessa Rasa',                     'loucas',     30.00, 150.00),
  ('Travessa Alta',                     'loucas',     35.00, 130.00),
  ('Bandeja Espelho',                   'decoracao',  25.00, 100.00),
  ('Base 5 Andares',                    'decoracao',  70.00, 150.00),
  ('Suqueira',                          'outros',     35.00, 100.00),
  ('Térmica',                           'outros',     30.00,  80.00),
  ('Xícara + Pires',                    'loucas',      3.00,  30.00),
  ('Prato de Lanche',                   'loucas',      1.50,  25.00),
  ('Talher Pequeno',                    'talheres',    2.00,  20.00),
  ('Prato STAFF',                       'loucas',      1.50,  40.00),
  ('Talher STAFF',                      'talheres',    2.00,  35.00)
ON CONFLICT ((lower(btrim(nome)))) DO UPDATE SET
  valor_locacao   = COALESCE(pecas.valor_locacao, EXCLUDED.valor_locacao),
  valor_reposicao = COALESCE(pecas.valor_reposicao, EXCLUDED.valor_reposicao);
