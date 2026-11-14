# PRD — Mini Manychat

> Status: **aprovado com ajustes (Fase 1)** — v2, integração via Zernio
> Data: 2026-11-02
> Uso: uma pessoa por instalação (cada um com sua Vercel, Neon, Upstash e Zernio)

---

## 0. Decisões tomadas

| # | Decisão | Escolha |
|---|---|---|
| D0 | Integração com o Instagram | **Zernio API** (a Zernio guarda o token da Meta e fala com a Graph API) |
| D0.1 | Quem executa a automação | **O app** (matching, fila, idempotência, rate limits, histórico). A Zernio só entrega o webhook `comment.received` e executa os envios. As "comment automations" nativas da Zernio **não** são usadas. |
| D1 | Material no DM | Private Reply = **texto + link**. Arquivo/imagem são hospedados no Vercel Blob e viram link. **Botão de link** opcional por palavra-chave (ver L3). |
| D2 | Correspondência | Padrão **"contém (palavra inteira)"**; opção **"exato"** por palavra-chave; sem diferenciar maiúsculas/acentos (§4.4). |
| D3 | Login | E-mail em `PAINEL_EMAIL` + senha com **hash scrypt** no banco (`account.password`, Better Auth). Senha inicial vem de `SENHA_PAINEL` via seed. Sem cadastro. Troca logada em Configurações › Segurança; esqueceu → `/login/esqueci` (e-mail + código 2FA/backup, sem e-mail de reset) ou `pnpm trocar-senha`. 2FA TOTP obrigatório. |
| D4 | Fila | **Vercel Queues** |
| D5 | Conta Zernio | Só `ZERNIO_API_KEY` é obrigatória. `ZERNIO_ACCOUNT_ID` é **opcional**: sem ela, o app descobre a conta via `GET /v1/accounts` (§6.2). |
| D6 | Analytics | Página própria juntando dados da automação (nosso banco) + Instagram e Inbox (Zernio) — §3.1 |

> Sobre a senha: guardamos um **hash** (scrypt, com salt), não a senha cifrada. Hash é irreversível; cifrar exigiria outra chave, o que não acrescenta proteção.

---

## 1. Visão geral e objetivo

Sistema de **usuária única**, inspirado no ManyChat, que automatiza a resposta a comentários no Instagram:

1. Cadastro de **palavras-chave** (ex.: `EBOOK`, `LINK`, `QUERO`), cada uma com:
   - **material** enviado por Direct (texto + link; arquivo ou imagem viram link);
   - **1 a 10 respostas públicas** — uma é sorteada a cada disparo.
2. Quando alguém comenta uma palavra-chave num post/reel meu: envia o material por **Direct** (Private Reply) e responde o comentário publicamente.
3. Escopo por palavra-chave: **todos os posts** ou **posts específicos**.
4. Painel com histórico: quem comentou, qual palavra, status do DM, status da resposta, erro.

**Métrica de sucesso:** ≥ 98% dos comentários válidos com DM enviado em até 60 s; zero DMs duplicados.

---

## 2. Fluxos

### 2.1 Fluxos da usuária

| Fluxo | Passos |
|---|---|
| **Primeiro acesso** | Login com `PAINEL_EMAIL` + senha → configura 2FA (obrigatório) → salva códigos de backup → dashboard. |
| **Login** | E-mail + senha → código TOTP → dashboard. |
| **Conectar Instagram** | Feito **uma vez no dashboard da Zernio** (OAuth da Zernio). No app: tela "Conexão" mostra a conta (`ZERNIO_ACCOUNT_ID`), saúde da conexão e do webhook, com botão "Testar webhook". |
| **Criar palavra-chave** | Palavras-chave → "Nova" → termo + modo → material (texto, link, upload de arquivo/imagem, botão opcional) → respostas públicas → escopo → salvar. |
| **Selecionar posts** | Dentro da palavra-chave → "Posts específicos" → grade com posts/reels (thumbnail, legenda, data) → marcar → salvar. Post antigo fora da grade: colar o link do post. |
| **Ver histórico** | Histórico → filtros (palavra, status, período) → detalhe do evento com erro e tentativas. |
| **Pausar tudo** | Dashboard → interruptor "Automação ativa" (kill switch). |

### 2.2 Fluxo técnico (comentário → webhook → DM → resposta)

```
Instagram → Meta → Zernio ──POST──▶ /api/webhooks/zernio
                                      1. Lê o corpo cru (≤ 1 MB)
                                      2. Valida X-Zernio-Signature (HMAC-SHA256 hex do corpo cru, ZERNIO_WEBHOOK_SECRET,
                                         comparação em tempo constante) └─ inválida/ausente → 401, nada é processado
                                      3. Valida o formato com Zod; aceita só event = "comment.received" e platform = "instagram"
                                      4. Rejeita evento com timestamp > 72 h (anti-replay; a Zernio reenvia por até ~51 h)
                                      5. INSERT webhook_deliveries (event_id) ON CONFLICT DO NOTHING      ← idempotência nº 1
                                         INSERT comment_events (ig_comment_id) ON CONFLICT DO NOTHING     ← idempotência nº 2
                                      6. Enfileira { comment_event_id } no Vercel Queues
                                      7. Responde 200 (a Zernio exige 2xx em < 5 s; meta interna < 500 ms)

Worker (consumidor da fila)
  1. Trava a linha (UPDATE ... SET status='processing' WHERE status IN ('queued','retry') RETURNING)
  2. Filtros, em ordem:
     a. automação pausada?                                → skipped_paused
     b. author.isOwnAccount = true OU author.id = meu id  → ignored_self (evita loop com as minhas respostas)
     c. comentário com mais de 7 dias?                    → expired
     d. comentário em Live (isLive)?                      → ignored_live
     e. palavra-chave casa? (§4.4)                         → senão no_match
     f. post está no escopo da palavra?                   → senão no_match
     g. anti-spam (§7.5)                                  → senão rate_limited_user
  3. INSERT dispatches (commenter, keyword, post) UNIQUE   ← idempotência nº 3   └─ conflito → duplicate
  4. Orçamento de saída (§7.5) ok? senão reagenda com atraso
  5. Private Reply: POST https://zernio.com/api/v1/inbox/comments/{platformPostId}/{commentId}/private-reply
                    { accountId, message, buttons? }
     ├─ 200 → salva dm_message_id
     ├─ 400 privateReplyConsumed → dm_status=failed_consumed, NUNCA retenta
     ├─ 502 privateReplyOutcome=unknown → dm_status=unknown, NÃO retenta; aparece no painel para checar
     └─ 429 / 5xx sem "unknown" → retry com backoff
     Se dm_message_id já existe, NÃO reenvia.
  6. Resposta pública: POST https://zernio.com/api/v1/inbox/comments/{platformPostId}
                       { accountId, commentId, message }  + header Idempotency-Key = comment_event_id
     └─ salva reply_comment_id. Se já existe, NÃO reenvia.
  7. status = done | partial | retry | failed

Retentativa: o evento volta para a fila (Vercel Queues) com o atraso do backoff.
Cron diário (rede de segurança): reprocessa eventos parados (retry vencido, queued ou processing travado).
```

O DM e a resposta pública têm estado próprio: falha na resposta pública nunca reenvia o DM.

---

## 3. Requisitos funcionais

| ID | Requisito |
|---|---|
| RF01 | Login com e-mail + senha (hash no banco) + 2FA TOTP obrigatório. Troca de senha logada, com a senha atual. |
| RF02 | Não existe rota de cadastro. Recuperação de senha só com código 2FA (TOTP ou backup), sem e-mail. |
| RF03 | Tela de conexão: conta Instagram via Zernio, saúde da conta (`GET /v1/accounts/{id}/health`), status do webhook, botão "Testar webhook". |
| RF04 | CRUD de palavras-chave: termo, modo (contém/exato), ativo/inativo. |
| RF05 | Material: texto (obrigatório, ≤ 1000 bytes), link opcional, upload de imagem (PNG/JPEG ≤ 8 MB), que vai como anexo depois que a pessoa responde o DM (PDF não: o Instagram não aceita documento no Direct); botão de link opcional (1 botão, rótulo ≤ 20 chars). |
| RF06 | 1 a 10 respostas públicas por palavra-chave; sorteio aleatório, sem repetir a última usada. |
| RF07 | Escopo: todos os posts ou posts/reels específicos (grade com os 25 mais recentes + posts já vistos em comentários + colar link). |
| RF08 | Aviso de conflito: duas palavras ativas com o mesmo termo normalizado e escopo sobreposto. |
| RF09 | Processar comentários em posts do feed e reels; ignorar Lives. |
| RF10 | Ignorar comentários da minha própria conta. |
| RF11 | Nunca 2 DMs para o mesmo comentário; no máximo 1 DM por pessoa por palavra-chave por post. |
| RF12 | Histórico paginado com filtros e detalhe do erro; exportação CSV. |
| RF13 | Dashboard: disparos hoje/7 dias, taxa de sucesso, erros recentes, uso do mês (DMs vs. cota da Zernio), saúde da conexão. |
| RF14 | Kill switch global "pausar automação". |
| RF15 | "Reprocessar" eventos `failed` dentro de 7 dias (nunca `failed_consumed` nem `unknown`). |
| RF16 | Pré-visualização do DM e da resposta pública antes de salvar. |
| RF17 | Se a conta receber o erro de botão recusado (subcode 1545133), o app desliga botões automaticamente e avisa no painel. |
| RF18 | Página **Analytics** com período (7/30/90 dias), comparação com o período anterior e os blocos da §3.1. |
| RF19 | Links do material passam por um redirecionador próprio (`/l/{token}`) que conta cliques, sem guardar IP nem dados da pessoa. |
| RF20 | Registrar quando o DM foi **lido** e quando a pessoa **respondeu** o DM (webhooks `message.read` e `message.received` da Zernio). |

### 3.1 Página de Analytics

Objetivo: em uma tela, ver se a automação está convertendo e como o perfil está indo.

**Bloco 1 — Funil da automação** (fonte: nosso banco)

```
Comentários recebidos → Com palavra-chave → DM enviado → DM lido → Clicou no link → Respondeu o DM
```

Cada etapa com número absoluto, % sobre a etapa anterior e variação vs. período anterior.

**Bloco 2 — Cards da automação** (fonte: nosso banco)

| Métrica | Como calcula |
|---|---|
| DMs enviados | `comment_events.dm_status = sent` |
| Taxa de sucesso do DM | enviados / (enviados + falhas) |
| Respostas públicas enviadas | `reply_status = sent` |
| Taxa de leitura ("vistas") | DMs com `dm_read_at` / DMs enviados |
| Cliques no material | `link_clicks` (1 por evento, cliques repetidos não somam) |
| Conversas iniciadas | DMs com `dm_replied_at` (a pessoa respondeu) |
| Tempo até o DM | mediana e p95 de (`dm_sent_at` − `comment_created_at`) |
| Bloqueados pelo anti-spam | `status = rate_limited_user` + `duplicate` |

**Bloco 3 — Por palavra-chave** (tabela): disparos, taxa de leitura, cliques, CTR (cliques / enviados), conversas, erros. Ordenável.

**Bloco 4 — Por post** (tabela com thumbnail): comentários com palavra, DMs enviados, cliques — cruzado com alcance e engajamento do post (Zernio). Mostra quais posts geram mais leads.

**Bloco 5 — Quando as pessoas comentam**: heatmap dia da semana × hora dos comentários com palavra-chave (nosso banco), ao lado do "seguidores online por hora" do Instagram (Zernio).

**Bloco 6 — Instagram** (fonte: Zernio, `GET /v1/analytics/instagram/account-insights` e `GET /v1/analytics/dashboard?compare=previous_period`)

| Métrica | Observação |
|---|---|
| Alcance, visualizações, contas engajadas, interações | Atraso de até 48 h (Meta) |
| Curtidas, comentários, compartilhamentos, salvamentos, taxa de engajamento | Soma dos posts do período, com período anterior |
| Seguidores ganhos/perdidos | `follower-history`; a série começa na data em que a conta foi conectada na Zernio |
| Top 5 posts por engajamento | `dashboard?topPosts=5` |
| Público: idade, gênero, cidades | `GET /v1/analytics/instagram/demographics` |

**Bloco 7 — Direct (Inbox)** (fonte: Zernio `GET /v1/analytics/inbox/volume` e `/response-time`): mensagens recebidas, enviadas, lidas, falhas, conversas únicas e tempo de resposta (mediana/p90).

**Cache:** dados da Zernio ficam em `analytics_snapshots` por 6 h; a página mostra o cache na hora e, se vencido, atualiza em segundo plano na visita (sem cron). Botão "Atualizar agora" limitado a **1 por 10 min**. Motivo: a Meta já atrasa até 48 h e o plano grátis tem 60 req/min.

## 4. Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF01 | Webhook responde `200` em < 500 ms (p95); limite duro da Zernio: 5 s. |
| RNF02 | DM enviado em < 60 s (p95) após o comentário, salvo throttling. |
| RNF03 | Processamento idempotente em 3 camadas (§2.2). |
| RNF04 | Nenhum segredo no código; tudo em variáveis de ambiente da Vercel (marcadas como Sensitive). |
| RNF05 | Logs estruturados (JSON) sem segredos, texto de comentário ou username. Só IDs internos. |
| RNF06 | Retenção do histórico: 90 dias, purga diária por cron (LGPD: minimização). |
| RNF07 | Interface em pt-BR, responsiva. |
| RNF08 | Acessibilidade: contraste AA, navegação por teclado. |
| RNF09 | Testes automatizados (Vitest) para webhook, matching e rate limits. |

### 4.4 Regra de correspondência (matching)

**Normalização** (comentário e termo): Unicode NFKD → remove diacríticos → minúsculas → pontuação e emojis viram espaço → colapsa espaços → trim.

| Modo | Regra | `quero` casa com… |
|---|---|---|
| **contém (palavra inteira)** — padrão | O termo aparece como sequência de palavras inteiras | "Quero!!", "eu QUERO 😍", "quêro muito" — **não** casa com "querooo" nem "requero" |
| **exato** | O comentário inteiro é igual ao termo | só "quero", "QUERO!", "Quêro" |

Substring não é usada: `LINK` não pode disparar em "linkedin".

**Desempate** (só 1 palavra dispara por comentário): escopo específico > global; exato > contém; termo mais longo; mais antiga.

---

## 5. Modelo de dados

ORM: **Drizzle** — migrations em SQL versionadas (onde escrevemos as políticas de RLS), suporte ao Neon e adapter oficial do Better Auth.

Todas as tabelas de domínio têm `user_id` para RLS, mesmo com usuária única (defesa em profundidade).

**Não guardamos token do Instagram.** O token da Meta fica com a Zernio, que também cuida da renovação. Nosso único acesso é a `ZERNIO_API_KEY`, que fica só no env.

### 5.1 Tabelas

**Better Auth:** `user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`. O único `user` é criado por script de seed a partir de `PAINEL_EMAIL`.

| Tabela | Campos principais | Restrições |
|---|---|---|
| `connection` | user_id (PK), zernio_account_id (descoberto ou vindo do env), ig_user_id, username, health_status, last_health_at, buttons_allowed, last_webhook_at | — |
| `link_clicks` | id, user_id, comment_event_id, keyword_id, first_clicked_at, click_count | UNIQUE(comment_event_id); **sem IP, user agent ou cookie** |
| `link_tokens` | token (PK, 128 bits aleatórios, base64url), user_id, comment_event_id, destination_url, expires_at (90 dias) | O destino vem do banco, nunca da URL |
| `analytics_snapshots` | user_id, kind (`ig_insights`/`ig_dashboard`/`ig_followers`/`ig_demographics`/`inbox_volume`/`inbox_response`), range_days, payload (jsonb), fetched_at | PK(user_id, kind, range_days) |
| `keywords` | id, user_id, term, term_normalized, match_mode (`contains`/`exact`), scope (`all`/`specific`), dm_text, dm_link_url, asset_id, button_label, active, last_reply_id, created_at, updated_at | CHECK octet_length(dm_text) ≤ 1000 |
| `keyword_replies` | id, user_id, keyword_id, text | CHECK length ≤ 300 |
| `keyword_posts` | user_id, keyword_id, platform_post_id | PK(keyword_id, platform_post_id) |
| `assets` | id, user_id, blob_url, mime, size_bytes, sha256 | CHECK mime IN (pdf, png, jpeg) |
| `posts_cache` | user_id, platform_post_id, caption, media_type, thumbnail_url, permalink, posted_at, fetched_at | PK(platform_post_id) |
| `webhook_deliveries` | event_id, user_id, received_at | **PK(event_id)** |
| `comment_events` | id, user_id, ig_comment_id, platform_post_id, commenter_id, commenter_username, comment_text (≤ 500), comment_created_at, keyword_id, status, dm_status, dm_message_id, dm_sent_at, dm_read_at, dm_replied_at, dm_error_code, reply_status, reply_comment_id, reply_error_code, attempts, next_attempt_at, source (`webhook`/`sweeper`), created_at, updated_at | **UNIQUE(ig_comment_id)** |
| `dispatches` | id, user_id, commenter_id, keyword_id, platform_post_id, comment_event_id, created_at | **UNIQUE(commenter_id, keyword_id, platform_post_id)** |
| `settings` | user_id (PK), automation_enabled, per_user_daily_cap, monthly_dm_budget | — |
| `audit_log` | id, user_id, action, ip_hash, created_at | só INSERT |

### 5.2 Papéis do Postgres

| Papel | Uso | BYPASSRLS | Observação |
|---|---|---|---|
| `neondb_owner` | Só migrations | sim (dono) | Nunca em runtime |
| `app_auth` | Better Auth | não | Só tabelas de auth |
| `app_web` | Rotas do painel | não | `SET LOCAL app.user_id` por transação, a partir da sessão validada |
| `app_worker` | Webhook, worker, crons | não | `SET LOCAL app.user_id` = dono da `connection` com o `zernio_account_id` do evento (função `SECURITY DEFINER` mínima) |

Em todas as tabelas: `ENABLE` **e** `FORCE ROW LEVEL SECURITY`. Sem `app.user_id`, as políticas retornam zero linhas (falha fechada).
Helper: `current_app_user() = nullif(current_setting('app.user_id', true), '')`.

### 5.3 Políticas de RLS

Condição padrão **(U)** = `user_id = current_app_user()`.

| Tabela | Papel | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| tabelas do Better Auth | `app_auth` | sim | sim | sim | sim |
| tabelas do Better Auth | `app_web`, `app_worker` | **sem GRANT** | — | — | — |
| `connection` | `app_web` | U | não (seed) | U, só `buttons_allowed` | não |
| `connection` | `app_worker` | U | não | U, só colunas de saúde/webhook | não |
| `keywords`, `keyword_replies`, `keyword_posts`, `assets` | `app_web` | U | U | U | U |
| idem | `app_worker` | U | não | U, só `keywords.last_reply_id` | não |
| `posts_cache` | `app_web`, `app_worker` | U | U | U | só `app_worker` |
| `webhook_deliveries` | `app_worker` | U | U | não | U (purga) |
| `webhook_deliveries` | `app_web` | **sem GRANT** | — | — | — |
| `comment_events` | `app_web` | U | não | U, só `status → retry` | não |
| `comment_events` | `app_worker` | U | U | U | U (purga 90 dias) |
| `dispatches` | `app_web` | U | não | não | não |
| `dispatches` | `app_worker` | U | U | não | U (purga) |
| `settings` | `app_web` | U | U | U | não |
| `settings` | `app_worker` | U | não | não | não |
| `audit_log` | `app_web`, `app_auth` | U | U | **não** | **não** |
| `link_tokens` | `app_worker` | U | U | não | U (purga após expirar) |
| `link_tokens` | `app_web` | **sem GRANT** | — | — | — |
| `link_clicks` | `app_worker` | U | U | U (só `click_count`) | U (purga 90 dias) |
| `link_clicks` | `app_web` | U | não | não | não |
| `analytics_snapshots` | `app_worker` | U | U | U | não |
| `analytics_snapshots` | `app_web` | U | não | não | não |

> O redirecionador `/l/{token}` roda como `app_worker`: é público (quem recebe o DM não tem sessão), resolve o token por função `SECURITY DEFINER` que só devolve `destination_url` e registra o clique.

Restrições de coluna via `GRANT UPDATE (col, ...)`.

---

## 6. Arquitetura e integrações

| Camada | Escolha | Motivo |
|---|---|---|
| App | Next.js (App Router) + TypeScript, **pnpm** | Exigido |
| Hospedagem | Vercel (Fluid Compute, Node runtime) | Exigido |
| Banco | Neon Postgres via integração nativa da Vercel | Exigido |
| ORM | Drizzle + `@neondatabase/serverless` (Pool/WebSocket) | Transação necessária para `SET LOCAL app.user_id` |
| Auth | Better Auth (`emailAndPassword` com `disableSignUp`, hash no banco) + plugin `twoFactor` | Exigido |
| Integração IG | Zernio API (`https://zernio.com/api/v1`, `Authorization: Bearer ZERNIO_API_KEY`) | D0 |
| Fila | Vercel Queues | Retentativa nativa, não bloqueia o webhook |
| Cron | Vercel Cron (protegido por `CRON_SECRET`) | Um só, diário: purga de 90 dias, sincroniza o perfil e reprocessa eventos parados |
| Rate limit | Better Auth (DB) para auth; Upstash Redis + `@upstash/ratelimit` para painel, saída e anti-spam; Vercel WAF na borda | Estado compartilhado em serverless |
| Arquivos | Vercel Blob | Link público para o material |
| Validação | Zod em toda rota, Server Action, payload de webhook e env | Exigido |
| Testes | Vitest | — |

### 6.1 Endpoints da Zernio usados

| Uso | Método e rota |
|---|---|
| Listar contas (achar `ZERNIO_ACCOUNT_ID`) | `GET /v1/accounts` |
| Saúde da conta | `GET /v1/accounts/{accountId}/health` |
| Posts recentes (25) | `GET /v1/accounts/{accountId}/posts` |
| Comentários de um post (varredor) | `GET /v1/inbox/comments/{postId}?accountId=` (cache de até 10 min) |
| Private Reply | `POST /v1/inbox/comments/{postId}/{commentId}/private-reply` |
| Resposta pública | `POST /v1/inbox/comments/{postId}` + `Idempotency-Key` |
| Configurar webhook | `POST /v1/webhooks/settings` (`name`, `url`, `events: ["comment.received","message.received","message.read","message.delivered"]`, `secret`) |
| Testar webhook | `POST /v1/webhooks/test` |
| Insights da conta | `GET /v1/analytics/instagram/account-insights?accountId=` |
| Dashboard (totais, top posts, período anterior) | `GET /v1/analytics/dashboard?platform=instagram&fromDate&toDate&compare=previous_period&topPosts=5` |
| Seguidores | `GET /v1/analytics/instagram/follower-history?accountId=` |
| Público | `GET /v1/analytics/instagram/demographics?accountId=` |
| Seguidores online por hora | `GET /v1/analytics/instagram/online-followers?accountId=` |
| Inbox: volume e tempo de resposta | `GET /v1/analytics/inbox/volume`, `GET /v1/analytics/inbox/response-time` |

Testado em 2026-11-02 com a conta real: todos os endpoints de analytics acima respondem 200 no plano atual.

### 6.2 Configuração (sem App Review)

A Zernio usa o app Meta dela, então **não há App Review nem app na Meta para criar**.

1. Criar conta na Zernio (plano grátis: 2 contas, 10 mil DMs enviados/mês).
2. Conectar a conta Instagram Business/Creator no dashboard da Zernio.
3. Criar API key (read/write, restrita ao perfil) → `ZERNIO_API_KEY`.
4. **Descoberta da conta** (sem passo manual): na primeira execução o app chama `GET /v1/accounts`, filtra `platform = instagram` e `isActive = true`:
   - exatamente 1 conta → salva o id em `connection.zernio_account_id`;
   - 0 contas → tela de Conexão mostra "Conecte o Instagram na Zernio";
   - 2+ contas → o app **não escolhe sozinho**: pede `ZERNIO_ACCOUNT_ID` no env.
   Se `ZERNIO_ACCOUNT_ID` existir no env, ele sempre vence.
5. Gerar `ZERNIO_WEBHOOK_SECRET` e registrar o webhook apontando para `{APP_URL}/api/webhooks/zernio` com os eventos da §6.1.
6. "Testar webhook" no painel do app.

---

## 7. Segurança

### 7.1 Autenticação (Better Auth)

| Controle | Configuração |
|---|---|
| Cadastro | `disableSignUp: true`; usuário único criado por seed |
| Senha | Hash scrypt em `account.password`; troca via `/change-password` (senha atual, 5 tentativas/15 min, encerra as outras sessões); mín. 8 caracteres |
| 2FA | Plugin `twoFactor` (TOTP + 10 códigos de backup); middleware bloqueia o painel sem 2FA ativo |
| Recuperação | Senha esquecida → `/login/esqueci` (código 2FA ou backup, 5 tentativas/15 min e 20/dia globais, encerra todas as sessões) ou `pnpm trocar-senha`; perda do 2FA → códigos de backup; perda dos códigos → script `pnpm reset-2fa` (ambos precisam de acesso ao banco) |
| Cookies | `httpOnly: true`, `secure: true`, `sameSite: 'lax'`, prefixo `__Secure-` |
| Sessão | 7 dias, renovada a cada 1 dia; ações sensíveis exigem sessão < 10 min |
| CSRF | Checagem de `Origin` do Better Auth + Server Actions |
| Auditoria | Login, falha de login, 2FA, mudança de configurações → `audit_log` (IP só como hash) |

### 7.2 Criptografia em repouso

- **Token do Instagram:** não fica no nosso banco (custódia da Zernio). Renovação feita pela Zernio; o app monitora a saúde a cada 1 h e mostra alerta se a conexão cair (`TOKEN_EXPIRED`).
- **Segredos nossos** (`ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET`): só em env da Vercel, marcados como **Sensitive** (cifrados, não legíveis depois de salvos). Rotação da `ZERNIO_API_KEY` a cada 90 dias.
- Segredos do 2FA: cifrados pelo Better Auth com `BETTER_AUTH_SECRET`.
- Neon criptografa o disco (AES-256).

### 7.3 Criptografia em trânsito

| Item | Configuração |
|---|---|
| Neon | `sslmode=require&channel_binding=require`; o app não inicia sem os dois |
| App | Só HTTPS; `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` |
| Zernio | Só `https://zernio.com/api/v1`; webhook só em HTTPS |
| CSP | `default-src 'self'; script-src 'self' 'nonce-{n}' 'strict-dynamic'; img-src 'self' https://*.cdninstagram.com https://*.fbcdn.net https://*.public.blob.vercel-storage.com data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` |
| Outros headers | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`, `X-Frame-Options: DENY` |

### 7.4 Webhook

1. Só `POST`, `Content-Type: application/json`, corpo ≤ 1 MB.
2. Lê o corpo **cru**; calcula `HMAC-SHA256(corpo, ZERNIO_WEBHOOK_SECRET)` em hex; compara com `X-Zernio-Signature` via `timingSafeEqual`. Sem header ou diferente → **401**, sem ler o JSON.
3. A assinatura da Zernio não inclui timestamp → anti-replay por `event_id` único + rejeição de `timestamp` > 72 h.
4. `accountId` do evento precisa ser igual ao `connection.zernio_account_id`; senão descarta.
5. Allowlist de eventos: `comment.received`, `message.received`, `message.read`, `message.delivered`. Qualquer outro → 200 e ignora.
6. `message.read` / `message.received` só atualizam `dm_read_at` / `dm_replied_at` de um `comment_event` já existente (casado pelo id da conversa/destinatário); nunca disparam envio.
7. Só depois: Zod → grava → enfileira → 200.

### 7.4.1 Redirecionador de links (`/l/{token}`)

- Token aleatório de 128 bits; sem token válido ou expirado → 404 (não revela se existiu).
- Destino lido do banco, nunca de parâmetro da URL → sem open redirect.
- Só aceita destinos `https://`.
- Registra apenas `first_clicked_at` e `click_count`; sem IP, user agent ou cookie (LGPD).
- Rate limit: **30 / min por IP** (Upstash).
- Responde `302` com `Referrer-Policy: no-referrer` e `Cache-Control: no-store`.
6. A Zernio reenvia até 7 vezes (~51 h); a idempotência absorve duplicatas.

> O requisito original de `verify_token` é específico do webhook da Meta. Com a Zernio ele não existe; a verificação equivalente é o evento de teste assinado (`POST /v1/webhooks/test`).

### 7.5 Rate limiting — todos os limites

| Camada | Onde | Limite | Justificativa |
|---|---|---|---|
| Login | Better Auth (`storage: 'database'`) | `/sign-in/email`: **5 / 15 min** por IP | Força bruta |
| 2FA | Better Auth | `/two-factor/*`: **5 / 5 min** por IP | 5 tentativas em 10⁶ combinações |
| Auth (demais) | Better Auth | **30 / min** | Padrão |
| Painel/API — leitura | Upstash | **120 / min por sessão**, **240 / min por IP** | Uso normal fica bem abaixo |
| Painel/API — escrita | Upstash | **30 / min por sessão** | Edição é rara |
| Upload | Upstash | **10 / h por sessão** | Abuso de armazenamento |
| Redirecionador `/l/{token}` | Upstash | **30 / min por IP** | Rota pública; evita inflar cliques e varredura de tokens |
| Analytics — "Atualizar agora" | Upstash | **1 / 10 min por sessão** | Cada atualização faz ~7 chamadas à Zernio |
| Analytics — cache | `analytics_snapshots` | **6 h** por snapshot, renovado na visita, ~7 chamadas | Meta atrasa até 48 h; cabe folgado nos 60 req/min |
| Borda | Vercel WAF | **300 / min por IP** (exceto webhook) | Barra varredura antes da função |
| Webhook | Vercel WAF | **600 / min por IP** em `/api/webhooks/zernio` | Alto para não perder evento; a assinatura é o controle real |
| Todas | — | **429** + `Retry-After` | Exigido |
| Saída — Zernio | Upstash (token bucket) | **45 req / min** | Plano grátis = 60/min; sobra 15/min para painel e crons. Lê `X-RateLimit-Remaining` e pausa quando < 5 |
| Saída — Private Reply | Upstash | **600 / h** | Meta: 750/h por conta; 20% de folga |
| Saída — resposta pública | Upstash | **300 / h** | Conservador para não parecer spam |
| Saída — cota mensal | Banco | Alerta em **8.000** DMs/mês; pausa em **10.000** | Cota grátis da Zernio; acima disso, sem cartão, a Zernio pausa os envios |
| Saída — concorrência | Fila | **2 envios simultâneos** | Ritmo humano |
| Anti-spam 1 | Banco (`dispatches` UNIQUE) | **1 DM por pessoa por palavra por post** | Exigido |
| Anti-spam 2 | Upstash | **3 DMs por pessoa / 24 h** | Evita colecionar materiais em vários posts |
| Anti-spam 3 | Upstash | **10 comentários por pessoa / 10 min** processados | Barra flood sem gastar chamadas |

**Retentativa:** backoff exponencial com jitter — 30 s, 2 min, 8 min, 30 min, 2 h, 6 h (6 tentativas). A própria Zernio já retenta 429/5xx da Meta 3 vezes. Erros permanentes (`privateReplyConsumed`, comentário apagado, usuário bloqueou) → `failed` sem retentativa. `privateReplyOutcome: unknown` → nunca retenta automaticamente. Sem retentativa de Private Reply após 6 dias e 23 h.

### 7.6 Geral

- Env validadas com Zod na inicialização; `.env*` no `.gitignore` (exceto `.env.example`).
- Zod em todas as rotas, Server Actions e payloads.
- Logs: campos proibidos (`token`, `secret`, `password`, `text`, `username`, `authorization`) removidos antes de logar.
- Upload: tipo validado pelos magic bytes, não pela extensão.
- `pnpm audit` no CI; lockfile commitado.
- SSRF: o servidor só chama hosts fixos (Zernio, Upstash, Blob).

---

## 8. Limitações

| # | Limitação | Impacto | Alternativa |
|---|---|---|---|
| L1 | Private Reply: **1 mensagem por comentário**, até **7 dias**; follow-up só se a pessoa responder (24 h). | Material inteiro numa mensagem. | Texto + link. |
| L2 | Anexo não vai na Private Reply; documento (PDF) não vai nem depois. | — | Imagem vai como anexo quando a pessoa responde o DM; sem upload de PDF. |
| L3 | Instagram pode **recusar botões para quem não segue** a conta (subcode 1545133) e **ainda gasta a única resposta**. | DM perdido. | Botão desligado por padrão; se o erro aparecer uma vez, o app desliga botões sozinho (RF17). |
| L4 | Meta: **750 Private Replies/h**. | Post viral passa disso. | Fila com 600/h; o resto espera (dentro de 7 dias). |
| L5 | Zernio grátis: **60 req/min** e **10 mil DMs/mês**. | ~22 comentários/min no máximo (2 chamadas cada). | Orçamento de 45 req/min; alerta de cota; cartão na Zernio libera $1 por 10 mil extras. |
| L6 | Zernio lista só os **25 posts mais recentes**. | Post antigo não aparece na grade. | Grade + posts vistos em comentários + colar link do post. |
| L7 | **Terceiro com acesso** à conta (DMs e comentários) e dependência de uma startup. | Se a Zernio cair ou mudar preço, a automação para. | Health check + alerta; arquitetura B isola a lógica — trocar para Meta direto só muda o cliente HTTP. |
| L8 | Conta precisa ser **pública** e **Business/Creator**. | — | Checagem na tela de conexão. |
| L9 | Webhook perdido além de ~51 h. | Evento some. | Varredor a cada 10 min (§2.2). |
| L10 | `isOwnAccount` pode vir ausente ("não avaliado"). | Risco de loop com as próprias respostas. | Comparar também `author.id` com o `ig_user_id` salvo. |
| L11 | Métricas do Instagram atrasam até **48 h** (Meta). | Números de ontem/hoje incompletos. | Aviso "dados com até 48 h de atraso" na página. |
| L12 | "Lido" depende da pessoa abrir o DM e do Instagram enviar o evento (mensagem em "Solicitações" pode não gerar leitura). | Taxa de leitura é estimativa por baixo. | Rotular como "≥". |
| L13 | Histórico de seguidores começa na data de conexão na Zernio. | Sem série antiga. | Mostrar a partir de quando houver dado. |

---

## 9. Fora de escopo

- Múltiplos usuários ou mais de 1 conta Instagram.
- Facebook, TikTok, Threads e outros canais (mesmo a Zernio suportando).
- Comment automations nativas, workflows e sequências da Zernio.
- Construtor visual de fluxos, IA para gerar respostas.
- Lives, Stories e menções.
- Broadcast para quem não comentou.
- Recuperação de senha por e-mail.
- App mobile nativo.

---

## 10. Critérios de aceite

| # | Cenário | Esperado |
|---|---|---|
| CA01 | Requisição para qualquer rota de sign-up ou reset | 404/403 |
| CA02 | Login sem 2FA configurado | Redireciona para configurar 2FA; painel bloqueado |
| CA03 | 6ª tentativa de login errada em 15 min | 429 com `Retry-After` |
| CA04 | Webhook sem `X-Zernio-Signature` ou com assinatura errada | 401; nada gravado |
| CA05 | Webhook com `accountId` diferente de `ZERNIO_ACCOUNT_ID` | Descartado |
| CA06 | "Quero!! 😍" com palavra `QUERO` (contém) | DM + resposta pública; histórico `done` |
| CA07 | "Quêro" com palavra `quero` (exato) | Dispara |
| CA08 | "linkedin" com palavra `LINK` | `no_match` |
| CA09 | Mesmo evento entregue 3 vezes | 1 DM só |
| CA10 | Mesma pessoa comenta `EBOOK` 2 vezes no mesmo post | 1 DM; 2º `duplicate` |
| CA11 | Comentário da minha conta (inclusive respostas automáticas) | `ignored_self`; nenhuma chamada à Zernio |
| CA12 | Palavra com escopo específico, comentário em outro post | `no_match` |
| CA13 | Zernio responde 429/5xx | Retentativa com backoff; DM não duplicado |
| CA14 | Zernio responde 400 `privateReplyConsumed` ou 502 `unknown` | Sem retentativa; visível no histórico |
| CA15 | DM enviado, resposta pública falha | Retenta só a resposta com a mesma `Idempotency-Key` |
| CA16 | Automação pausada | `skipped_paused`; nenhuma chamada |
| CA17 | `app_web` sem `app.user_id` faz `SELECT * FROM keywords` | 0 linhas |
| CA18 | `app_web` tenta ler `webhook_deliveries` ou tabelas de auth | Erro de permissão |
| CA19 | `DATABASE_URL` sem `sslmode=require` ou `channel_binding=require` | App não inicia |
| CA20 | Headers de resposta | HSTS, CSP, nosniff, Referrer-Policy, Permissions-Policy presentes (teste) |
| CA21 | Busca nos logs por segredo, texto de comentário ou username | Nenhuma ocorrência |
| CA22 | 4º DM da mesma pessoa em 24 h | `rate_limited_user` |
| CA23 | Webhook desligado por 30 min, comentários chegam | Varredor processa em ≤ 10 min, sem duplicar |
| CA24 | Testes de webhook, matching e rate limit | Todos passam |
| CA25 | Sem `ZERNIO_ACCOUNT_ID` e 1 conta Instagram na Zernio | App descobre e salva o id sozinho |
| CA26 | Sem `ZERNIO_ACCOUNT_ID` e 2 contas Instagram | App não envia nada e pede o id no env |
| CA27 | Pessoa abre o DM / clica no link / responde | `dm_read_at`, `link_clicks`, `dm_replied_at` preenchidos; funil atualiza |
| CA28 | `/l/{token}` com token inválido, expirado ou `?url=` na query | 404; nunca redireciona para destino fora do banco |
| CA29 | Página Analytics aberta 10 vezes seguidas | 0 chamadas extras à Zernio (lê do cache) |
| CA30 | `link_clicks` no banco | Sem IP, user agent ou identificador da pessoa |

---

## 11. Revisão de segurança — Fase 1 (PRD)

| Item | Verificado no PRD |
|---|---|
| A01 Controle de acesso | RLS com `FORCE`, 4 papéis sem BYPASSRLS, falha fechada, GRANT por coluna (§5.2–5.3) |
| A02 Criptografia | Nenhum token da Meta no banco; segredos só em env Sensitive; TLS + channel binding; HSTS preload (§7.2–7.3) |
| A03 Injeção | Drizzle parametrizado; Zod em todas as entradas; CSP com nonce |
| A04 Design inseguro | Idempotência em 3 camadas; kill switch; anti-spam; tratamento de `unknown`/`consumed` sem retentativa |
| A05 Configuração | Sem cadastro nem reset; headers; env validadas |
| A06 Componentes | `pnpm audit`, lockfile |
| A07 Autenticação | Hash scrypt no banco, 2FA obrigatório, rate limit em login/2FA com storage no banco, cookies seguros |
| A08 Integridade | HMAC do webhook em tempo constante; anti-replay por event_id + idade; checagem de `accountId` |
| A09 Logs | Sem dados sensíveis; `audit_log` imutável |
| A10 SSRF | Allowlist de hosts de saída |
| Terceiros | Risco da Zernio documentado (L7); key com escopo mínimo e rotação |

---

## 12. Fontes

- [Zernio — Webhooks (assinatura, retries)](https://docs.zernio.com/webhooks)
- [Zernio — Inbox webhooks (`comment.received`)](https://docs.zernio.com/webhooks/inbox)
- [Zernio — Send private reply](https://docs.zernio.com/comments/send-private-reply-to-comment)
- [Zernio — Reply to comment](https://docs.zernio.com/comments/reply-to-inbox-post)
- [Zernio — Rate limits](https://docs.zernio.com/guides/rate-limits)
- [Zernio — Preços](https://www.zernio.com/pricing)
- [Zernio — Analytics dashboard](https://docs.zernio.com/analytics/get-analytics-dashboard)
- [Zernio — Instagram insights](https://docs.zernio.com/analytics/get-instagram-account-insights)
- [Zernio — Inbox volume](https://docs.zernio.com/inbox-analytics/get-inbox-volume)
- [Meta — Private Replies](https://developers.facebook.com/docs/instagram-platform/private-replies)
