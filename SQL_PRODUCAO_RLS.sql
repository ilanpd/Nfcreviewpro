-- ============================================================================
-- RLS (segurança em nível de linha) nas tabelas antigas — Pulse
-- ----------------------------------------------------------------------------
-- POR QUE: no Supabase, os papéis públicos `anon` e `authenticated` têm permissão
-- (grant) em TODAS as tabelas do schema `public`. Sem RLS, quem tiver a URL do
-- projeto e a chave pública (anon key) consegue LER E ESCREVER essas tabelas pela
-- API de dados do Supabase (PostgREST), sem passar pelo seu app. Hoje, em Produção,
-- 33 das 39 tabelas estão assim (StoreOrder com CPF/CNPJ, telefone e endereço,
-- Company, User, NFCCard, ApiKey, Visit...). As 5 tabelas do estoque de placas já
-- têm RLS ligado desde o SQL do estoque (ADR-092).
--
-- O QUE FAZ: liga RLS em toda tabela do schema `public` que ainda não tem. Sem
-- nenhuma política, `anon` e `authenticated` passam a não ver NADA. O app NÃO é
-- afetado: ele conecta como o dono das tabelas (papel `postgres`), que ignora o
-- RLS — é o mesmo caminho que já funciona nas 5 tabelas do estoque.
--
-- PODE RODAR DIRETO EM PRODUÇÃO (projeto "Nfc Review Pro"). Conferido em 05/10/2026,
-- só leitura de catálogo, na conexão que o app usa:
--   * o app conecta como o papel `postgres`, que tem BYPASSRLS e é DONO das 39 tabelas;
--   * nenhuma tabela usa FORCE RLS (que prenderia até o dono);
--   * não existe nenhuma política hoje, e o código não usa o cliente do Supabase
--     (nada depende de acesso `anon`/`authenticated`);
--   * as 5 tabelas do estoque já rodam com RLS ligado em Produção e o app grava nelas.
-- Ou seja: ligar o RLS não muda nada para o app; só fecha a porta lateral da API
-- do Supabase. Rodar antes no Staging é uma precaução opcional, não uma exigência.
--
-- COMO USAR (SQL Editor do Supabase):
--   1) Cole este arquivo inteiro e rode. Leva menos de 1 segundo (cada tabela é
--      travada só enquanto a transação roda).
--   2) Confira o resultado do bloco "VERIFICAÇÃO": sem_rls = 0 e
--      pedidos_visiveis_para_anon = 0.
--   3) Me avise: eu confiro o site por fora (páginas, toque na placa).
--
-- É REVERSÍVEL: veja o bloco "PLANO DE VOLTA" no fim. É transacional: se algo
-- falhar, nada é alterado.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  t record;
  ligadas int := 0;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    ligadas := ligadas + 1;
    RAISE NOTICE 'RLS ligado em %', t.relname;
  END LOOP;
  RAISE NOTICE 'Total de tabelas alteradas: %', ligadas;
END $$;

COMMIT;

-- ----------------------------------------------------------------------------
-- VERIFICAÇÃO (somente leitura). Esperado: sem_rls = 0.
-- ----------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE c.relrowsecurity)     AS com_rls,
  count(*) FILTER (WHERE NOT c.relrowsecurity) AS sem_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';

-- ----------------------------------------------------------------------------
-- PROVA (somente leitura): como o papel público, a tabela de pedidos deve
-- aparecer VAZIA mesmo havendo pedidos. Esperado: 0.
-- ----------------------------------------------------------------------------
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS pedidos_visiveis_para_anon FROM public."StoreOrder";
ROLLBACK;

-- ----------------------------------------------------------------------------
-- PLANO DE VOLTA (só se algo inesperado acontecer; NÃO rode junto com o acima).
-- Desliga o RLS em todas as tabelas, EXCETO as 5 do estoque, que já estavam com
-- RLS ligado antes deste arquivo (ADR-092) e devem continuar assim.
--
--   BEGIN;
--   DO $$
--   DECLARE t record;
--   BEGIN
--     FOR t IN
--       SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
--         AND c.relname NOT IN ('Plate', 'PlateBatch', 'PlateEvent', 'PlateModel', 'PlateModelVersion')
--     LOOP
--       EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t.relname);
--     END LOOP;
--   END $$;
--   COMMIT;
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- OPCIONAL, depois que o app estiver confirmado funcionando por alguns dias:
-- tirar também a permissão dos papéis públicos (cinto e suspensório). O app não
-- usa o cliente do Supabase, então nada depende dessas permissões.
--
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
-- ----------------------------------------------------------------------------
