-- =============================================
-- Migração 2026-10 — documentos (orçamento, contrato e recibo de entrega)
--
-- Para o banco que JÁ ESTÁ NO AR (criado com uma versão anterior do
-- schema.sql). Banco novo não precisa: o schema.sql já tem tudo isto.
-- Rodar no SQL Editor do Supabase, inteiro. Pode rodar de novo sem
-- estragar nada.
--
-- O que muda:
--   * peça ganha preço de locação por unidade;
--   * cada item do evento guarda o preço cobrado naquele evento;
--   * evento ganha número sequencial (impresso nos documentos), frete,
--     desconto e "quem recebe as peças".
-- =============================================

ALTER TABLE pecas
  ADD COLUMN IF NOT EXISTS valor_locacao NUMERIC(12,2) CHECK (valor_locacao >= 0);

ALTER TABLE evento_itens
  ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0);

-- Os eventos que já existem são numerados na hora, sem disparar triggers.
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS numero       BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  ADD COLUMN IF NOT EXISTS recebe_pecas TEXT,
  ADD COLUMN IF NOT EXISTS frete        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (frete >= 0),
  ADD COLUMN IF NOT EXISTS desconto     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0);

-- A view lista as colunas de "pecas" do momento em que foi criada; sem
-- recriá-la, o preço de locação não apareceria.
DROP VIEW IF EXISTS pecas_estoque;
CREATE VIEW pecas_estoque WITH (security_invoker = true) AS
SELECT
  p.*,
  COALESCE((SELECT SUM(m.delta) FROM movimentos_acervo m WHERE m.peca_id = p.id), 0)::INTEGER
    AS estoque
FROM pecas p;
GRANT SELECT ON pecas_estoque TO authenticated;

CREATE OR REPLACE FUNCTION salvar_peca(
  p_id         UUID,
  p_dados      JSONB,
  p_quantidade INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id    UUID := p_id;
  v_atual INTEGER;
BEGIN
  IF p_quantidade IS NULL OR p_quantidade < 0 THEN
    RAISE EXCEPTION 'Quantidade inválida.' USING ERRCODE = 'P0001';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO pecas (nome, categoria, valor_reposicao, valor_locacao, observacoes)
    VALUES (
      btrim(p_dados->>'nome'),
      p_dados->>'categoria',
      NULLIF(p_dados->>'valor_reposicao', '')::NUMERIC,
      NULLIF(p_dados->>'valor_locacao', '')::NUMERIC,
      NULLIF(btrim(p_dados->>'observacoes'), '')
    )
    RETURNING id INTO v_id;
    IF p_quantidade > 0 THEN
      INSERT INTO movimentos_acervo (peca_id, delta, motivo) VALUES (v_id, p_quantidade, 'cadastro');
    END IF;
    RETURN v_id;
  END IF;

  UPDATE pecas SET
    nome            = btrim(p_dados->>'nome'),
    categoria       = p_dados->>'categoria',
    valor_reposicao = NULLIF(p_dados->>'valor_reposicao', '')::NUMERIC,
    valor_locacao   = NULLIF(p_dados->>'valor_locacao', '')::NUMERIC,
    observacoes     = NULLIF(btrim(p_dados->>'observacoes'), ''),
    ativo           = COALESCE((p_dados->>'ativo')::BOOLEAN, ativo)
  WHERE id = v_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Peça não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT estoque INTO v_atual FROM pecas_estoque WHERE id = v_id;
  IF p_quantidade <> v_atual THEN
    INSERT INTO movimentos_acervo (peca_id, delta, motivo, observacao)
    VALUES (v_id, p_quantidade - v_atual, 'ajuste', 'Ajuste manual no cadastro da peça');
    -- Reduzir o estoque pode deixar reservas já confirmadas sem peça.
    -- Não bloqueia (o acervo físico é o que é), mas a tela avisa.
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION salvar_evento(
  p_id       UUID,
  p_dados    JSONB,
  p_itens    JSONB,
  p_parcelas JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id UUID := p_id;
BEGIN
  IF v_id IS NULL THEN
    INSERT INTO eventos (
      cliente_id, titulo, tipo_evento, data_evento, data_saida, data_retorno,
      local, recebe_pecas, convidados, frete, desconto, valor_total, status, observacoes
    ) VALUES (
      (p_dados->>'cliente_id')::UUID,
      btrim(p_dados->>'titulo'),
      NULLIF(btrim(p_dados->>'tipo_evento'), ''),
      (p_dados->>'data_evento')::DATE,
      (p_dados->>'data_saida')::DATE,
      (p_dados->>'data_retorno')::DATE,
      NULLIF(btrim(p_dados->>'local'), ''),
      NULLIF(btrim(p_dados->>'recebe_pecas'), ''),
      NULLIF(p_dados->>'convidados', '')::INTEGER,
      COALESCE(NULLIF(p_dados->>'frete', '')::NUMERIC, 0),
      COALESCE(NULLIF(p_dados->>'desconto', '')::NUMERIC, 0),
      COALESCE(NULLIF(p_dados->>'valor_total', '')::NUMERIC, 0),
      COALESCE(p_dados->>'status', 'orcamento'),
      NULLIF(btrim(p_dados->>'observacoes'), '')
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE eventos SET
      cliente_id   = (p_dados->>'cliente_id')::UUID,
      titulo       = btrim(p_dados->>'titulo'),
      tipo_evento  = NULLIF(btrim(p_dados->>'tipo_evento'), ''),
      data_evento  = (p_dados->>'data_evento')::DATE,
      data_saida   = (p_dados->>'data_saida')::DATE,
      data_retorno = (p_dados->>'data_retorno')::DATE,
      local        = NULLIF(btrim(p_dados->>'local'), ''),
      recebe_pecas = NULLIF(btrim(p_dados->>'recebe_pecas'), ''),
      convidados   = NULLIF(p_dados->>'convidados', '')::INTEGER,
      frete        = COALESCE(NULLIF(p_dados->>'frete', '')::NUMERIC, 0),
      desconto     = COALESCE(NULLIF(p_dados->>'desconto', '')::NUMERIC, 0),
      valor_total  = COALESCE(NULLIF(p_dados->>'valor_total', '')::NUMERIC, 0),
      -- sem "status" no payload, o status atual é mantido
      status       = COALESCE(p_dados->>'status', status),
      observacoes  = NULLIF(btrim(p_dados->>'observacoes'), '')
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Evento não encontrado.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Itens: a lista enviada é a lista final.
  DELETE FROM evento_itens
   WHERE evento_id = v_id
     AND peca_id NOT IN (
       SELECT (x->>'peca_id')::UUID FROM jsonb_array_elements(COALESCE(p_itens, '[]')) x
     );
  INSERT INTO evento_itens (evento_id, peca_id, quantidade, valor_unitario)
  SELECT v_id, (x->>'peca_id')::UUID, (x->>'quantidade')::INTEGER,
         COALESCE(NULLIF(x->>'valor_unitario', '')::NUMERIC, 0)
    FROM jsonb_array_elements(COALESCE(p_itens, '[]')) x
  ON CONFLICT (evento_id, peca_id) DO UPDATE SET
    quantidade     = EXCLUDED.quantidade,
    valor_unitario = EXCLUDED.valor_unitario;

  -- Parcelas
  DELETE FROM parcelas
   WHERE evento_id = v_id
     AND tipo <> 'avaria'
     AND status = 'pendente'
     AND id NOT IN (
       SELECT (x->>'id')::UUID FROM jsonb_array_elements(COALESCE(p_parcelas, '[]')) x
        WHERE x->>'id' IS NOT NULL
     );

  UPDATE parcelas pa SET
    tipo            = x->>'tipo',
    valor           = (x->>'valor')::NUMERIC,
    data_vencimento = (x->>'data_vencimento')::DATE
  FROM jsonb_array_elements(COALESCE(p_parcelas, '[]')) x
  WHERE x->>'id' IS NOT NULL
    AND pa.id = (x->>'id')::UUID
    AND pa.evento_id = v_id
    AND pa.tipo <> 'avaria';

  INSERT INTO parcelas (evento_id, tipo, valor, data_vencimento)
  SELECT v_id, x->>'tipo', (x->>'valor')::NUMERIC, (x->>'data_vencimento')::DATE
    FROM jsonb_array_elements(COALESCE(p_parcelas, '[]')) x
   WHERE x->>'id' IS NULL;

  -- Roda a checagem de disponibilidade agora, dentro da função, em vez
  -- de esperar o COMMIT: assim o erro chega como resposta desta chamada.
  SET CONSTRAINTS trg_eventos_disponibilidade, trg_itens_disponibilidade IMMEDIATE;

  RETURN v_id;
END;
$$;
