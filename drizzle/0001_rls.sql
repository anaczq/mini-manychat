-- PRD §5.2–5.3: papéis sem BYPASSRLS, GRANT mínimo por tabela/coluna e RLS forçada em todas as tabelas.
-- As senhas dos papéis são definidas fora da migration, por `pnpm db:roles`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_web') THEN CREATE ROLE app_web NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_worker') THEN CREATE ROLE app_worker NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_auth') THEN CREATE ROLE app_auth NOLOGIN NOBYPASSRLS; END IF;
END $$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_web, app_worker, app_auth;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION current_app_user() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION current_app_user() TO app_web, app_worker, app_auth;
--> statement-breakpoint

-- ───────────── RLS ligada e forçada em todas as tabelas ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user','session','account','verification','two_factor','rate_limit',
    'connection','assets','keywords','keyword_replies','keyword_posts','posts_cache','webhook_deliveries',
    'comment_events','dispatches','settings','audit_log','link_tokens','link_clicks','analytics_snapshots']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ───────────── Better Auth: só app_auth ─────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON "user", session, account, verification, two_factor, rate_limit TO app_auth;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user','session','account','verification','two_factor','rate_limit'] LOOP
    EXECUTE format('CREATE POLICY auth_all ON %I FOR ALL TO app_auth USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ───────────── connection ─────────────
GRANT SELECT ON connection TO app_web, app_worker;
GRANT UPDATE (buttons_allowed) ON connection TO app_web;
GRANT INSERT ON connection TO app_worker;
GRANT UPDATE (zernio_account_id, ig_user_id, username, health_status, last_health_at, last_webhook_at, buttons_allowed) ON connection TO app_worker;
--> statement-breakpoint
CREATE POLICY own_rows ON connection FOR ALL TO app_web, app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── automações (web escreve, worker lê) ─────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON assets, keywords, keyword_replies, keyword_posts TO app_web;
GRANT SELECT ON assets, keywords, keyword_replies, keyword_posts TO app_worker;
GRANT UPDATE (last_reply_id) ON keywords TO app_worker;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['assets','keywords','keyword_replies','keyword_posts'] LOOP
    EXECUTE format('CREATE POLICY own_rows ON %I FOR ALL TO app_web, app_worker USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user())', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- ───────────── posts_cache ─────────────
GRANT SELECT, INSERT, UPDATE ON posts_cache TO app_web, app_worker;
GRANT DELETE ON posts_cache TO app_worker;
CREATE POLICY own_rows ON posts_cache FOR ALL TO app_web, app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── webhook_deliveries: só worker ─────────────
GRANT SELECT, INSERT, DELETE ON webhook_deliveries TO app_worker;
CREATE POLICY own_rows ON webhook_deliveries FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── comment_events ─────────────
GRANT SELECT ON comment_events TO app_web;
GRANT UPDATE (status, next_attempt_at, updated_at) ON comment_events TO app_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON comment_events TO app_worker;
CREATE POLICY own_rows ON comment_events FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
CREATE POLICY web_read ON comment_events FOR SELECT TO app_web USING (user_id = current_app_user());
-- O painel só pode mover um evento falho para "retry" (botão Reprocessar).
CREATE POLICY web_retry ON comment_events FOR UPDATE TO app_web
  USING (user_id = current_app_user() AND status = 'failed')
  WITH CHECK (user_id = current_app_user() AND status = 'retry');
--> statement-breakpoint

-- ───────────── dispatches ─────────────
GRANT SELECT ON dispatches TO app_web;
GRANT SELECT, INSERT, DELETE ON dispatches TO app_worker;
CREATE POLICY own_rows ON dispatches FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
CREATE POLICY web_read ON dispatches FOR SELECT TO app_web USING (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── settings ─────────────
GRANT SELECT, INSERT, UPDATE ON settings TO app_web;
GRANT SELECT ON settings TO app_worker;
CREATE POLICY own_rows ON settings FOR ALL TO app_web, app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── audit_log: só INSERT/SELECT, nunca UPDATE/DELETE ─────────────
GRANT SELECT, INSERT ON audit_log TO app_web, app_auth;
CREATE POLICY own_rows ON audit_log FOR SELECT TO app_web, app_auth USING (user_id = current_app_user());
CREATE POLICY own_insert ON audit_log FOR INSERT TO app_web, app_auth WITH CHECK (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── links e cliques ─────────────
GRANT SELECT, INSERT, DELETE ON link_tokens TO app_worker;
CREATE POLICY own_rows ON link_tokens FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
GRANT SELECT ON link_clicks TO app_web;
GRANT SELECT, INSERT, DELETE ON link_clicks TO app_worker;
GRANT UPDATE (click_count) ON link_clicks TO app_worker;
CREATE POLICY own_rows ON link_clicks FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
CREATE POLICY web_read ON link_clicks FOR SELECT TO app_web USING (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── analytics_snapshots ─────────────
GRANT SELECT ON analytics_snapshots TO app_web;
GRANT SELECT, INSERT, UPDATE ON analytics_snapshots TO app_worker;
CREATE POLICY own_rows ON analytics_snapshots FOR ALL TO app_worker
  USING (user_id = current_app_user()) WITH CHECK (user_id = current_app_user());
CREATE POLICY web_read ON analytics_snapshots FOR SELECT TO app_web USING (user_id = current_app_user());
--> statement-breakpoint

-- ───────────── Funções SECURITY DEFINER mínimas ─────────────
-- Webhook não tem sessão: descobre o dono da conta Zernio para depois fazer SET LOCAL app.user_id.
CREATE OR REPLACE FUNCTION app_owner_of_account(account_id text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT user_id FROM connection WHERE zernio_account_id = account_id LIMIT 1 $$;
REVOKE ALL ON FUNCTION app_owner_of_account(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_owner_of_account(text) TO app_worker;
--> statement-breakpoint
-- Redirecionador público /l/{token}: devolve só o destino e conta o clique.
CREATE OR REPLACE FUNCTION app_resolve_link(p_token text) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r link_tokens%ROWTYPE; kw text;
BEGIN
  SELECT * INTO r FROM link_tokens WHERE token = p_token AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT keyword_id INTO kw FROM comment_events WHERE id = r.comment_event_id;
  INSERT INTO link_clicks (user_id, comment_event_id, keyword_id)
    VALUES (r.user_id, r.comment_event_id, kw)
    ON CONFLICT (comment_event_id) DO UPDATE SET click_count = link_clicks.click_count + 1;
  RETURN r.destination_url;
END $$;
REVOKE ALL ON FUNCTION app_resolve_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_resolve_link(text) TO app_worker;
