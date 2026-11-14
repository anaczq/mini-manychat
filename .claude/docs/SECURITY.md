# Segurança — revisão das Fases 3 e 4

Data: 2026-11-03. Referência: PRD §7 e OWASP Top 10 (2021).

## Verificado

| Item | Como foi verificado | Status |
|---|---|---|
| **A01 · Controle de acesso** | `pnpm test:rls`: 17 verificações no banco real (sem sessão = 0 linhas; painel sem acesso a login/2FA/tokens; audit_log imutável; sem DELETE do painel no histórico) | ✓ |
| Rotas do painel exigem sessão + 2FA | `requireUser()` em todo layout/página/Server Action/rota; `proxy.ts` redireciona sem cookie | ✓ |
| Rotas públicas mínimas | só `/login*`, `/api/auth/*`, `/api/webhooks/*`, `/api/cron/*` (com `CRON_SECRET`), `/l/*` | ✓ |
| **A02 · Criptografia** | Neon com `sslmode=require&channel_binding=require` validado no boot (Zod); HSTS preload; segredos só em env da Vercel (Sensitive em produção) | ✓ |
| Token do Instagram em repouso | não fica no app (custódia da Zernio); 2FA cifrado pelo Better Auth | ✓ |
| **A03 · Injeção** | Drizzle parametrizado; Zod em todas as Server Actions, rotas e payloads; CSP com nonce; CSV com proteção contra fórmula | ✓ |
| **A04 · Design** | idempotência em 3 camadas; cada passo do envio gravado na hora (DM nunca reenviado); `privateReplyConsumed`/`unknown` sem retentativa; kill switch | ✓ |
| **A05 · Configuração** | sem cadastro/reset; headers de segurança; `poweredByHeader: false`; `robots: noindex` | ✓ |
| **A06 · Componentes** | dependências recentes; lockfile commitado | ✓ (rodar `pnpm audit` no deploy) |
| **A07 · Autenticação** | senha só como hash scrypt no banco (troca exige a senha atual e encerra as outras sessões; reset só por script com acesso ao banco); 2FA obrigatório; rate limit de login (5/15 min) e 2FA (5/5 min) com storage no banco; cookies `httpOnly`/`secure`/`sameSite=lax` | ✓ |
| **A08 · Integridade** | webhook: HMAC-SHA256 em tempo constante **antes** de ler o JSON; anti-replay 72 h; `accountId` conferido; testes (`route.test.ts`) | ✓ |
| Upload | token emitido só com sessão+2FA; tipos e tamanho limitados; assinatura conferida pelos bytes; arquivo apagado se não bater (`assets.test.ts`) | ✓ |
| **A09 · Logs** | logs só com IDs e códigos; audit_log de login (com HMAC do IP, nunca o IP) e ações sensíveis | ✓ |
| **A10 · SSRF** | o servidor só chama hosts fixos (Zernio, Upstash, Blob); registro de arquivo aceita só `*.public.blob.vercel-storage.com` no caminho da própria usuária | ✓ |
| Rate limits (PRD §7.5) | Upstash + Better Auth; testes em `ratelimit.test.ts`; 429 com `Retry-After` | ✓ |

## Pendências e diferenças em relação ao PRD

| Item | Situação | Plano |
|---|---|---|
| Fila (PRD D4: Vercel Queues) | processamento com `after()` logo após o webhook + retentativas pelo cron | suficiente para 1 conta; trocar por Queues se o volume crescer |
| Frequência do cron | diário (limite do plano Hobby) | retentativas mais rápidas acontecem a cada novo webhook; no Pro, mudar para 5 min |
| Vercel WAF | regra ativa: 300 req/min por IP em tudo, menos `/api/webhooks/` (Hobby permite só 1 regra de rate limit) | webhook protegido por HMAC + idempotência + limite no app |
| Cache da sessão em cookie assinado (2 min) | sessão revogada ainda vale até 2 min | aceito: evita uma consulta ao banco por página |
| Tentativas de login falhas no audit_log | só sucessos são registrados; falhas ficam no rate limit do banco | aceito para v1 |
| Cliques no link do DM | não são mais contados: o DM leva o link do destino (pedido da usuária) | `/l/{token}` continua no código, sem uso |
