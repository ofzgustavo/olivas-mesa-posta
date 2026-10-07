-- =============================================
-- Olivas Mesa Posta — Schema do sistema de gestão
-- Rodar UMA VEZ, inteiro, no SQL Editor do Supabase (banco novo).
-- =============================================
--
-- Regras de negócio que moram no banco (e não só na tela), para que
-- nenhum caminho do app consiga violá-las:
--
-- 1. ESTOQUE DO ACERVO = soma de movimentos_acervo. Nunca é um número
--    editado à mão numa coluna: cadastro, ajuste, compra de peça nova,
--    reposição e quebra/perda viram, cada um, um movimento. Assim o
--    estoque é sempre explicável ("por que tenho 46 taças?").
--
-- 2. RESERVA SÓ EXISTE EM EVENTO CONFIRMADO OU REALIZADO. Orçamento não
--    segura peça. O evento passa de orçamento para confirmado sozinho
--    quando o primeiro pagamento é registrado.
--
-- 3. NUNCA HÁ RESERVA DUPLICADA. Uma peça fica presa da data de saída à
--    data de retorno do evento. Em nenhum dia desse período a soma
--    reservada pode passar do estoque. A checagem é uma constraint
--    trigger DEFERRED: roda no COMMIT, quando evento, itens e status já
--    estão no estado final — e trava as peças envolvidas (FOR UPDATE),
--    então dois salvamentos simultâneos não passam juntos.
--
-- 4. AVARIA GERA COBRANÇA. Registrar quebra/dano/perda cria a parcela de
--    cobrança no evento; quebra e perda também baixam a peça do acervo.
-- =============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CLIENTES
-- =============================================
CREATE TABLE clientes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nome        TEXT        NOT NULL CHECK (btrim(nome) <> ''),
  telefone    TEXT,
  email       TEXT,
  cpf_cnpj    TEXT,
  endereco    TEXT,
  observacoes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ACERVO
-- =============================================
CREATE TABLE pecas (
  id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            TEXT          NOT NULL CHECK (btrim(nome) <> ''),
  categoria       TEXT          NOT NULL
                    CHECK (categoria IN ('loucas', 'sousplats', 'tacas_copos', 'talheres',
                                         'toalhas', 'guardanapos', 'decoracao', 'outros')),
  -- preço de reposição de UMA unidade; sugere o valor da cobrança de avaria
  valor_reposicao NUMERIC(12,2) CHECK (valor_reposicao >= 0),
  observacoes     TEXT,
  -- peça aposentada some das listas de escolha, mas o histórico fica
  ativo           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ   DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pecas_nome ON pecas (lower(btrim(nome)));

-- =============================================
-- EVENTOS
-- =============================================
CREATE TABLE eventos (
  id           UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id   UUID          NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  titulo       TEXT          NOT NULL CHECK (btrim(titulo) <> ''),
  tipo_evento  TEXT,
  data_evento  DATE          NOT NULL,
  -- período em que as peças ficam fora do acervo (montagem, evento,
  -- retorno e lavagem). Padrão do app: sai no dia, volta 3 dias depois.
  data_saida   DATE          NOT NULL,
  data_retorno DATE          NOT NULL,
  local        TEXT,
  convidados   INTEGER       CHECK (convidados > 0),
  -- preço personalizado combinado com o cliente (locação + montagem)
  valor_total  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  status       TEXT          NOT NULL DEFAULT 'orcamento'
                 CHECK (status IN ('orcamento', 'confirmado', 'realizado', 'cancelado')),
  observacoes  TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  CHECK (data_saida <= data_evento AND data_evento <= data_retorno)
);

CREATE TABLE evento_itens (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id  UUID    NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  peca_id    UUID    NOT NULL REFERENCES pecas(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  UNIQUE (evento_id, peca_id)
);

-- =============================================
-- AVARIAS (quebra, dano ou perda de peça num evento)
-- =============================================
CREATE TABLE avarias (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id   UUID          NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  peca_id     UUID          NOT NULL REFERENCES pecas(id) ON DELETE RESTRICT,
  quantidade  INTEGER       NOT NULL CHECK (quantidade > 0),
  -- quebra e perda tiram a peça do acervo; dano não (a peça continua lá)
  tipo        TEXT          NOT NULL CHECK (tipo IN ('quebra', 'dano', 'perda')),
  valor       NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data        DATE          NOT NULL,
  -- vencimento da cobrança gerada para o cliente
  vencimento  DATE          NOT NULL,
  observacoes TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- =============================================
-- PARCELAS (tudo que o cliente paga: sinal, saldo, parcelas, avarias)
-- =============================================
-- Sem coluna "numero": a ordem é a do vencimento. Numerar à mão abria
-- espaço para colisão ao apagar e recriar parcelas.
CREATE TABLE parcelas (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id        UUID          NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  tipo             TEXT          NOT NULL
                     CHECK (tipo IN ('sinal', 'saldo', 'parcela', 'avista', 'avaria')),
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_vencimento  DATE          NOT NULL,
  data_recebimento DATE,
  -- "vencido" nunca é gravado: é derivado da data (ver statusEfetivo)
  status           TEXT          NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'recebido')),
  -- só nas parcelas de avaria; somem junto com a avaria
  avaria_id        UUID          UNIQUE REFERENCES avarias(id) ON DELETE CASCADE,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW(),
  CHECK ((status = 'recebido') = (data_recebimento IS NOT NULL)),
  CHECK ((tipo = 'avaria') = (avaria_id IS NOT NULL))
);

-- =============================================
-- DESPESAS
-- =============================================
CREATE TABLE despesas (
  id         UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  data       DATE          NOT NULL,
  valor      NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  categoria  TEXT          NOT NULL
               CHECK (categoria IN ('frete', 'reposicao', 'trafego_pago', 'aquisicao', 'outros')),
  descricao  TEXT          NOT NULL CHECK (btrim(descricao) <> ''),
  -- opcional: despesa de um evento específico (ex.: frete) entra no
  -- resultado daquele evento
  evento_id  UUID          REFERENCES eventos(id) ON DELETE SET NULL,
  -- opcional, só em reposição/aquisição: a peça comprada entra no acervo
  peca_id    UUID          REFERENCES pecas(id) ON DELETE RESTRICT,
  quantidade_pecas INTEGER CHECK (quantidade_pecas > 0),
  created_at TIMESTAMPTZ   DEFAULT NOW(),
  updated_at TIMESTAMPTZ   DEFAULT NOW(),
  CHECK ((peca_id IS NULL) = (quantidade_pecas IS NULL)),
  CHECK (peca_id IS NULL OR categoria IN ('reposicao', 'aquisicao'))
);

-- =============================================
-- MOVIMENTOS DO ACERVO (o estoque é a soma destes)
-- =============================================
CREATE TABLE movimentos_acervo (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  peca_id    UUID        NOT NULL REFERENCES pecas(id) ON DELETE CASCADE,
  -- positivo entra no acervo, negativo sai
  delta      INTEGER     NOT NULL CHECK (delta <> 0),
  motivo     TEXT        NOT NULL
               CHECK (motivo IN ('cadastro', 'ajuste', 'aquisicao', 'reposicao', 'avaria')),
  data       DATE        NOT NULL DEFAULT CURRENT_DATE,
  despesa_id UUID        UNIQUE REFERENCES despesas(id) ON DELETE CASCADE,
  avaria_id  UUID        UNIQUE REFERENCES avarias(id) ON DELETE CASCADE,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_eventos_cliente      ON eventos(cliente_id);
CREATE INDEX idx_eventos_data         ON eventos(data_evento);
CREATE INDEX idx_eventos_periodo      ON eventos(data_saida, data_retorno);
CREATE INDEX idx_eventos_status       ON eventos(status);
CREATE INDEX idx_itens_peca           ON evento_itens(peca_id);
CREATE INDEX idx_avarias_evento       ON avarias(evento_id);
CREATE INDEX idx_parcelas_evento      ON parcelas(evento_id);
CREATE INDEX idx_parcelas_vencimento  ON parcelas(data_vencimento);
CREATE INDEX idx_parcelas_recebimento ON parcelas(data_recebimento);
CREATE INDEX idx_despesas_data        ON despesas(data);
CREATE INDEX idx_despesas_evento      ON despesas(evento_id);
CREATE INDEX idx_movimentos_peca      ON movimentos_acervo(peca_id);

-- =============================================
-- updated_at automático
-- =============================================
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pecas_updated_at    BEFORE UPDATE ON pecas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_eventos_updated_at  BEFORE UPDATE ON eventos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parcelas_updated_at BEFORE UPDATE ON parcelas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_despesas_updated_at BEFORE UPDATE ON despesas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================
-- ESTOQUE
-- =============================================
-- security_invoker: a view respeita o RLS de quem consulta (sem isso,
-- uma view no Supabase roda com o dono e ignora o RLS).
CREATE VIEW pecas_estoque WITH (security_invoker = true) AS
SELECT
  p.*,
  COALESCE((SELECT SUM(m.delta) FROM movimentos_acervo m WHERE m.peca_id = p.id), 0)::INTEGER
    AS estoque
FROM pecas p;

-- Quanto de cada peça está reservado no período [p_inicio, p_fim]: o
-- MAIOR total reservado num mesmo dia do período — não a soma de tudo
-- que toca o período. Dois eventos que caem na mesma semana mas em dias
-- diferentes não disputam a mesma peça.
CREATE OR REPLACE FUNCTION reservas_no_periodo(
  p_inicio  DATE,
  p_fim     DATE,
  p_ignorar UUID DEFAULT NULL
)
RETURNS TABLE (peca_id UUID, reservado INTEGER)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT x.peca_id, MAX(x.total)::INTEGER
  FROM (
    SELECT i.peca_id, d.dia, SUM(i.quantidade) AS total
    FROM generate_series(p_inicio, p_fim, INTERVAL '1 day') AS d(dia)
    JOIN eventos e
      ON e.status IN ('confirmado', 'realizado')
     AND e.data_saida <= d.dia::DATE
     AND e.data_retorno >= d.dia::DATE
     AND (p_ignorar IS NULL OR e.id <> p_ignorar)
    JOIN evento_itens i ON i.evento_id = e.id
    GROUP BY i.peca_id, d.dia
  ) x
  GROUP BY x.peca_id;
$$;

-- Disponibilidade de todas as peças ativas num período. É o que a tela
-- do acervo e o formulário de evento consultam.
CREATE OR REPLACE FUNCTION disponibilidade_pecas(
  p_inicio  DATE,
  p_fim     DATE,
  p_ignorar UUID DEFAULT NULL
)
RETURNS TABLE (peca_id UUID, estoque INTEGER, reservado INTEGER, disponivel INTEGER)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.estoque,
    COALESCE(r.reservado, 0),
    p.estoque - COALESCE(r.reservado, 0)
  FROM pecas_estoque p
  LEFT JOIN reservas_no_periodo(p_inicio, p_fim, p_ignorar) r ON r.peca_id = p.id;
$$;

-- =============================================
-- REGRA 3: nunca reservar mais do que existe
-- =============================================
CREATE OR REPLACE FUNCTION verificar_disponibilidade(p_evento_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev        eventos%ROWTYPE;
  r         RECORD;
  faltas    TEXT[] := '{}';
BEGIN
  SELECT * INTO ev FROM eventos WHERE id = p_evento_id;
  IF NOT FOUND OR ev.status NOT IN ('confirmado', 'realizado') THEN
    RETURN;
  END IF;

  -- Trava as peças do evento: outra transação que tente reservar as
  -- mesmas peças espera esta terminar e então enxerga o resultado dela.
  PERFORM 1 FROM pecas
   WHERE id IN (SELECT peca_id FROM evento_itens WHERE evento_id = p_evento_id)
   ORDER BY id
   FOR UPDATE;

  FOR r IN
    SELECT p.nome, i.quantidade, p.estoque, COALESCE(res.reservado, 0) AS outros
    FROM evento_itens i
    JOIN pecas_estoque p ON p.id = i.peca_id
    LEFT JOIN reservas_no_periodo(ev.data_saida, ev.data_retorno, ev.id) res
      ON res.peca_id = i.peca_id
    WHERE i.evento_id = p_evento_id
      AND i.quantidade + COALESCE(res.reservado, 0) > p.estoque
    ORDER BY p.nome
  LOOP
    faltas := faltas || format('%s (pedido %s, livre %s)',
      r.nome, r.quantidade, GREATEST(r.estoque - r.outros, 0));
  END LOOP;

  IF array_length(faltas, 1) > 0 THEN
    RAISE EXCEPTION 'Peças indisponíveis entre % e %: %',
      to_char(ev.data_saida, 'DD/MM/YYYY'),
      to_char(ev.data_retorno, 'DD/MM/YYYY'),
      array_to_string(faltas, '; ')
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trg_verificar_evento()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM verificar_disponibilidade(NEW.id);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION trg_verificar_item()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM verificar_disponibilidade(NEW.evento_id);
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_eventos_disponibilidade
  AFTER INSERT OR UPDATE ON eventos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status IN ('confirmado', 'realizado'))
  EXECUTE FUNCTION trg_verificar_evento();

CREATE CONSTRAINT TRIGGER trg_itens_disponibilidade
  AFTER INSERT OR UPDATE ON evento_itens
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION trg_verificar_item();

-- =============================================
-- REGRA 2: primeiro pagamento confirma o evento
-- =============================================
CREATE OR REPLACE FUNCTION trg_parcela_confirma_evento()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'recebido' AND NEW.tipo <> 'avaria' THEN
    UPDATE eventos SET status = 'confirmado'
     WHERE id = NEW.evento_id AND status = 'orcamento';
    -- Checa já, e não só no COMMIT: o erro volta na própria requisição
    -- que tentou registrar o pagamento, com a lista de peças em falta.
    PERFORM verificar_disponibilidade(NEW.evento_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_parcelas_confirma_evento
  AFTER INSERT OR UPDATE OF status ON parcelas
  FOR EACH ROW EXECUTE FUNCTION trg_parcela_confirma_evento();

-- =============================================
-- REGRA 4: avaria → cobrança (+ baixa no acervo se quebra/perda)
-- =============================================
CREATE OR REPLACE FUNCTION trg_avaria_criada()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO parcelas (evento_id, tipo, valor, data_vencimento, avaria_id, observacoes)
  VALUES (NEW.evento_id, 'avaria', NEW.valor, NEW.vencimento, NEW.id, NEW.observacoes);

  IF NEW.tipo IN ('quebra', 'perda') THEN
    INSERT INTO movimentos_acervo (peca_id, delta, motivo, data, avaria_id)
    VALUES (NEW.peca_id, -NEW.quantidade, 'avaria', NEW.data, NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_avarias_criada
  AFTER INSERT ON avarias
  FOR EACH ROW EXECUTE FUNCTION trg_avaria_criada();

-- Avaria cuja cobrança já foi paga não pode sumir: apagar a avaria
-- apagaria junto o registro de um dinheiro que entrou.
CREATE OR REPLACE FUNCTION trg_avaria_protege_recebida()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM parcelas WHERE avaria_id = OLD.id AND status = 'recebido') THEN
    RAISE EXCEPTION 'A cobrança desta avaria já foi recebida. Desfaça o recebimento antes de excluí-la.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_avarias_protege_recebida
  BEFORE DELETE ON avarias
  FOR EACH ROW EXECUTE FUNCTION trg_avaria_protege_recebida();

-- Avarias não são editadas: exclua e registre de novo. Evita que valor,
-- peça ou quantidade fiquem diferentes da cobrança e do acervo.
CREATE OR REPLACE FUNCTION trg_bloquear_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro não editável: exclua e registre de novo.' USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_avarias_sem_update
  BEFORE UPDATE ON avarias
  FOR EACH ROW EXECUTE FUNCTION trg_bloquear_update();

-- A parcela de uma avaria é dela: só o status/recebimento muda por fora.
CREATE OR REPLACE FUNCTION trg_parcela_avaria_protegida()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- permitido só em cascata: a própria avaria ou o evento sendo apagado
    IF OLD.avaria_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM avarias WHERE id = OLD.avaria_id)
       AND EXISTS (SELECT 1 FROM eventos WHERE id = OLD.evento_id) THEN
      RAISE EXCEPTION 'Esta cobrança pertence a uma avaria. Exclua a avaria.' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.tipo <> OLD.tipo OR NEW.avaria_id IS DISTINCT FROM OLD.avaria_id
     OR (OLD.tipo = 'avaria' AND NEW.valor <> OLD.valor) THEN
    RAISE EXCEPTION 'Esta cobrança pertence a uma avaria. Exclua e registre a avaria de novo.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcelas_avaria_protegida
  BEFORE UPDATE OR DELETE ON parcelas
  FOR EACH ROW EXECUTE FUNCTION trg_parcela_avaria_protegida();

-- =============================================
-- Despesa de reposição/aquisição com peça → entra no acervo
-- =============================================
CREATE OR REPLACE FUNCTION trg_despesa_acervo()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM movimentos_acervo WHERE despesa_id = NEW.id;
  IF NEW.peca_id IS NOT NULL THEN
    INSERT INTO movimentos_acervo (peca_id, delta, motivo, data, despesa_id)
    VALUES (NEW.peca_id, NEW.quantidade_pecas, NEW.categoria, NEW.data, NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_despesas_acervo
  AFTER INSERT OR UPDATE ON despesas
  FOR EACH ROW EXECUTE FUNCTION trg_despesa_acervo();

-- =============================================
-- RPC: salvar peça (cadastro + quantidade num passo só)
-- =============================================
-- p_quantidade é o estoque que a usuária diz ter. Se difere do estoque
-- calculado, a diferença vira um movimento ('cadastro' na criação,
-- 'ajuste' depois). Devolve o id da peça.
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
    INSERT INTO pecas (nome, categoria, valor_reposicao, observacoes)
    VALUES (
      btrim(p_dados->>'nome'),
      p_dados->>'categoria',
      NULLIF(p_dados->>'valor_reposicao', '')::NUMERIC,
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

-- =============================================
-- RPC: salvar evento (dados + itens + parcelas num passo só)
-- =============================================
-- Tudo ou nada: se qualquer parte falhar — inclusive a checagem de
-- disponibilidade no COMMIT — nada é gravado. Nada de evento salvo sem
-- parcelas, nem parcela nova perdida em silêncio.
--
-- p_itens:    [{ "peca_id": "...", "quantidade": 10 }, ...]
--             (substitui a lista inteira de itens)
-- p_parcelas: [{ "id": "..."?, "tipo": "sinal", "valor": 500,
--               "data_vencimento": "2026-11-01" }, ...]
--             Parcelas com id são atualizadas; sem id, criadas. As
--             parcelas não-avaria do evento que ficarem de fora da lista
--             são apagadas — exceto as já recebidas, que nunca somem
--             por aqui.
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
      local, convidados, valor_total, status, observacoes
    ) VALUES (
      (p_dados->>'cliente_id')::UUID,
      btrim(p_dados->>'titulo'),
      NULLIF(btrim(p_dados->>'tipo_evento'), ''),
      (p_dados->>'data_evento')::DATE,
      (p_dados->>'data_saida')::DATE,
      (p_dados->>'data_retorno')::DATE,
      NULLIF(btrim(p_dados->>'local'), ''),
      NULLIF(p_dados->>'convidados', '')::INTEGER,
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
      convidados   = NULLIF(p_dados->>'convidados', '')::INTEGER,
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
  INSERT INTO evento_itens (evento_id, peca_id, quantidade)
  SELECT v_id, (x->>'peca_id')::UUID, (x->>'quantidade')::INTEGER
    FROM jsonb_array_elements(COALESCE(p_itens, '[]')) x
  ON CONFLICT (evento_id, peca_id) DO UPDATE SET quantidade = EXCLUDED.quantidade;

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

-- =============================================
-- RPC: mudar o status do evento
-- =============================================
-- Confirmar (ou voltar de cancelado para confirmado) checa a
-- disponibilidade na hora, e o erro volta nesta chamada.
CREATE OR REPLACE FUNCTION alterar_status_evento(p_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE eventos SET status = p_status WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evento não encontrado.' USING ERRCODE = 'P0001';
  END IF;
  SET CONSTRAINTS trg_eventos_disponibilidade IMMEDIATE;
END;
$$;

-- =============================================
-- ROW LEVEL SECURITY (só usuária autenticada)
-- =============================================
ALTER TABLE clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pecas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evento_itens      ENABLE ROW LEVEL SECURITY;
ALTER TABLE avarias           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentos_acervo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados" ON clientes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON pecas             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON eventos           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON evento_itens      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON avarias           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON parcelas          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON despesas          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "autenticados" ON movimentos_acervo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Funções expostas pela API só para quem está logado.
REVOKE EXECUTE ON FUNCTION reservas_no_periodo(DATE, DATE, UUID)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION disponibilidade_pecas(DATE, DATE, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION verificar_disponibilidade(UUID)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION salvar_peca(UUID, JSONB, INTEGER)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION salvar_evento(UUID, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION alterar_status_evento(UUID, TEXT)      FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION reservas_no_periodo(DATE, DATE, UUID)   TO authenticated;
GRANT  EXECUTE ON FUNCTION disponibilidade_pecas(DATE, DATE, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION verificar_disponibilidade(UUID)         TO authenticated;
GRANT  EXECUTE ON FUNCTION salvar_peca(UUID, JSONB, INTEGER)       TO authenticated;
GRANT  EXECUTE ON FUNCTION salvar_evento(UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION alterar_status_evento(UUID, TEXT)      TO authenticated;
