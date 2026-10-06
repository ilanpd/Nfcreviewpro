-- ============================================================================
-- RLS (segurança em nível de linha) nas tabelas antigas — Pulse
-- ----------------------------------------------------------------------------
-- STATUS: JÁ EXECUTADO em Produção em 05/10/2026 (39 de 39 tabelas com RLS,
-- conferido por consulta de catálogo). Mantido como registro e para qualquer
-- ambiente novo (Staging, restauração, projeto novo). É idempotente: só toca
-- tabelas que ainda não têm RLS.
--
-- POR QUE: é uma SEGUNDA TRAVA (defesa em camadas). O Supabase expõe o schema
-- `public` pela API de dados (PostgREST); o RLS garante que, mesmo que alguém dê
-- uma permissão por engano no futuro, as linhas continuam fechadas.
--
-- CORREÇÃO (05/10/2026): a primeira versão deste arquivo e a auditoria diziam que,
-- sem RLS, quem tivesse a chave pública poderia LER E ESCREVER essas tabelas. Isso
-- estava ERRADO. Medi pelo ACL real (`has_table_privilege`): os papéis `anon` e
-- `authenticated` NUNCA tiveram SELECT/INSERT/UPDATE/DELETE nelas, só TRUNCATE,
-- REFERENCES, TRIGGER e MAINTAIN, que a API de dados não alcança. O erro foi usar
-- `information_schema.role_table_grants`, que lista QUALQUER privilégio, e ler
-- "tem permissão em 39 tabelas" como "pode ler e escrever". O RLS continua valendo
-- como proteção extra, mas não fechou uma porta que estivesse aberta.
--
-- O QUE FAZ: liga RLS em toda tabela do schema `public` que ainda não tem. Sem
-- nenhuma política, `anon` e `authenticated` não veriam NADA mesmo se tivessem
-- permissão. O app NÃO é afetado: conecta como `postgres`, que tem BYPASSRLS e é
-- DONO das 39 tabelas (nenhuma com FORCE RLS), não há política nenhuma, e o código
-- não usa o cliente do Supabase. Conferido depois de ligar: o site segue lendo os
-- dados reais normalmente.
--
-- COMO USAR (SQL Editor do Supabase): cole e rode. Leva menos de 1 segundo e é
-- transacional: se algo falhar, nada é alterado. Veja o "PLANO DE VOLTA" no fim.
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
-- PROVA (somente leitura): em quantas tabelas o papel público TEM permissão de
-- ler ou escrever? Esperado: 0 nas duas linhas.
-- (Não use `SET ROLE anon` + SELECT como prova: o resultado esperado é um erro
-- "permission denied", que confunde, porque o papel nem tem permissão de leitura.)
-- ----------------------------------------------------------------------------
SELECT
  r.papel,
  count(*) FILTER (
    WHERE has_table_privilege(r.papel, format('public.%I', c.relname), 'SELECT,INSERT,UPDATE,DELETE')
  ) AS tabelas_com_leitura_ou_escrita
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated')) AS r(papel)
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY r.papel
ORDER BY r.papel;

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
-- OPCIONAL (cosmético): tirar também os privilégios que sobraram (TRUNCATE,
-- REFERENCES, TRIGGER, MAINTAIN) dos papéis públicos. O app não usa o cliente do
-- Supabase, então nada depende deles. Reduz o que o "Security Advisor" do Supabase
-- pode apontar.
--
--   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
-- ----------------------------------------------------------------------------
