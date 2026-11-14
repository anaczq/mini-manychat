# Mini Manychat

Painel que responde comentários do Instagram: quando alguém comenta uma palavra-chave num post ou reel, o app manda o material por **Direct** (resposta privada) e responde o **comentário publicamente**. Uma pessoa por instalação.

- Stack: Next.js 16 (App Router) · TypeScript · pnpm · Neon Postgres (RLS) · Drizzle · Better Auth + 2FA · Upstash Redis · Vercel Blob · Zernio
- Requisitos completos: [`PRD.md`](./PRD.md) · Publicar: [`DEPLOY.md`](./DEPLOY.md) · Segurança: [`SECURITY.md`](./SECURITY.md)

> **Não é dev?** Abra esta pasta no app do Claude e diga "quero configurar". O Claude segue o roteiro em `.claude/CLAUDE.md` e faz os comandos por você.

## Como funciona

```
comentário → Meta → Zernio → POST /api/webhooks/zernio (HMAC) → comment_events
          → processador: matching → anti-spam → Private Reply (DM) → resposta pública
```

- O token do Instagram fica com a **Zernio** (ela renova). O app só guarda a `ZERNIO_API_KEY`.
- O nome e a foto no painel vêm da conta Instagram conectada na Zernio.
- Cada comentário vira **um** registro (idempotência por ID do evento, do comentário e por pessoa+palavra+post). O DM nunca é reenviado.
- Links do DM passam por `/l/{token}`, que conta cliques sem guardar IP.

## O que você precisa

- Node 24+ e pnpm 10 (`corepack enable pnpm`). O Vercel CLI já vem no projeto (`pnpm exec vercel`).
- Conta na **Vercel** (Hobby, grátis). Neon e Upstash são criados **pela Vercel** (aba Storage), sem conta separada.
- Conta na **Zernio** com o Instagram **profissional** conectado.
- App autenticador no celular (2FA obrigatório).

## Configurar (primeira vez)

```bash
pnpm install
pnpm exec vercel login
pnpm exec vercel link --yes --project mini-manychat
# no painel da Vercel → projeto → Storage: conectar Neon (Postgres) e Upstash (Redis), região São Paulo
pnpm configurar --email voce@exemplo.com --zernio sk_...
pnpm dev                                     # http://localhost:3000
```

O `pnpm configurar` grava e-mail e chave da Zernio na Vercel, gera os segredos, cria tabelas + RLS + papéis do banco, cria a conta e liga o Instagram, e confere a RLS no fim. Pode rodar de novo sem estragar nada. No terminal ele pede a senha; rodando pelo Claude, gera uma senha provisória.

No primeiro login o app pede para configurar o 2FA (QR code + 10 códigos de backup).

**Todas as variáveis vivem na Vercel.** O `.env.local` é só uma cópia: atualize com `pnpm env:pull` (mantém o `PUBLIC_URL` do túnel, que o `vercel env pull` apagaria).

### Variáveis de ambiente

| Variável | De onde vem | Para quê |
|---|---|---|
| `PAINEL_EMAIL` | `pnpm configurar` | e-mail do login |
| `ZERNIO_API_KEY` | painel da Zernio → API Keys | acesso à conta Instagram |
| `ZERNIO_ACCOUNT_ID` | `pnpm configurar --conta` | só se houver mais de 1 conta Instagram na Zernio |
| `ZERNIO_WEBHOOK_SECRET` / `BETTER_AUTH_SECRET` / `CRON_SECRET` | `pnpm secrets` (o configurar chama) | HMAC do webhook / sessões e 2FA / protege o cron |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | integração Neon na Vercel | base para os papéis / **só migrations** |
| `DATABASE_URL_WEB` / `_WORKER` / `_AUTH` | `pnpm db:roles` (o configurar chama) | um papel do Postgres por função, sem BYPASSRLS |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | integração Upstash na Vercel | rate limits |
| `BLOB_READ_WRITE_TOKEN` | Blob na Vercel (opcional) | upload de imagem; sem ele, material só por link |
| `APP_URL` | só em produção (`DEPLOY.md`) | URL do painel (padrão `http://localhost:3000`) |
| `PUBLIC_URL` | `pnpm zernio:webhook <url> --local` | URL do túnel usada nos links do DM em dev |

Todas as URLs dos papéis precisam de `sslmode=require&channel_binding=require`; sem isso o app não inicia.

### Testar o webhook no computador (túnel)

```bash
brew install cloudflared                              # uma vez (ou baixe no site da Cloudflare)
pnpm tunel                                            # copie a URL https://…trycloudflare.com
pnpm zernio:webhook https://…trycloudflare.com --local   # cadastra o webhook, grava PUBLIC_URL e envia um teste
```

Reinicie o `pnpm dev` e comente a palavra-chave **de outra conta** num post com automação ligada. Comentários da sua própria conta são ignorados de propósito. Só funciona com o computador ligado; para 24 h, veja [`DEPLOY.md`](./DEPLOY.md).

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm configurar` | configuração completa (idempotente) |
| `pnpm dev` / `pnpm build` | servidor local / build de produção |
| `pnpm env:pull` | traz as variáveis da Vercel para o `.env.local` |
| `pnpm tunel` | túnel Cloudflare para `localhost:3000` |
| `pnpm zernio:webhook <url> [--local]` | cadastra/atualiza o webhook `mini-manychat` na Zernio |
| `pnpm test` / `pnpm test:rls` | testes / confere RLS e permissões no banco real (sem alterar dados) |
| `pnpm typecheck` / `pnpm lint` | TypeScript / ESLint |
| `pnpm db:generate` / `pnpm db:migrate` | nova migration / aplicar migrations |
| `pnpm db:roles` | rotaciona as senhas dos papéis do Postgres e grava na Vercel (produção precisa de novo deploy) |
| `pnpm db:seed` | conta, configurações e conexão com a Zernio (idempotente) |
| `pnpm trocar-senha` | esqueceu a senha: grava uma nova no banco e encerra as sessões |
| `pnpm env:push [APP_URL]` | copia e-mail e Zernio do `.env.local` para a produção e define `APP_URL` |

## Segurança (resumo)

- **Login:** uma pessoa só, sem cadastro. Senha como hash scrypt no banco (`account.password`); troca em Configurações › Segurança (pede a senha atual, encerra as outras sessões). Esqueceu: `/login/esqueci` com e-mail + código 2FA ou de backup (5 tentativas/15 min, global; derruba todas as sessões), ou `pnpm trocar-senha`. 2FA obrigatório. Cookies `httpOnly`, `secure`, `sameSite=lax`.
- **Banco:** RLS ligada e **forçada** em todas as 20 tabelas. Papéis `app_web`, `app_worker` e `app_auth` sem BYPASSRLS e com GRANT por coluna. Sem `app.user_id`, as políticas devolvem zero linhas.
- **Em trânsito:** TLS + channel binding no Neon; HSTS preload; CSP com nonce; nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options.
- **Webhook:** HMAC-SHA256 em tempo constante antes de ler o JSON; anti-replay (72 h); idempotência por evento e por comentário.
- **Rate limits:** login 5/15 min, 2FA 5/5 min (no banco); painel 30 escritas/min; upload 10/h; links 30/min por IP; saída 45 req/min para a Zernio; 600 Private Replies/h; 3 DMs por pessoa em 24 h; 10 comentários por pessoa em 10 min.
- **Arquivos:** tipo conferido pelos primeiros bytes (PNG/JPEG); o que não bate é apagado.
- **Logs:** só IDs e códigos; nunca texto de comentário, @ ou segredos. Histórico apagado após 90 dias.

Detalhes e checklist da revisão: [`SECURITY.md`](./SECURITY.md).
