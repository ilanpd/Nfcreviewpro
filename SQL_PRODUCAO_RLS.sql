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
-- COMO USAR (nesta ordem, você roda no SQL Editor do Supabase):
--   1) STAGING primeiro (projeto "Nfc Review Pro 2"). Rode, depois abra o app em
--      Staging e confira: login, /admin, /admin/pedidos, /dashboard, /loja, um
--      toque em /r/<código> e a criação de um cartão.
--   2) PRODUÇÃO (projeto "Nfc Review Pro") só depois do passo 1 passar.
--   3) Rode o bloco "VERIFICAÇÃO" no fim e confira que "sem_rls" deu 0.
--
-- É REVERSÍVEL: para desfazer uma tabela, `ALTER TABLE public."Tabela" DISABLE ROW
-- LEVEL SECURITY;`. É transacional: se algo falhar, nada é alterado.
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
-- OPCIONAL, depois que o app estiver confirmado funcionando por alguns dias:
-- tirar também a permissão dos papéis públicos (cinto e suspensório). O app não
-- usa o cliente do Supabase, então nada depende dessas permissões.
--
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
-- ----------------------------------------------------------------------------
