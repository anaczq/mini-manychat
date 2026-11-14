# Mini Manychat — instruções para o Claude

Painel que responde comentários do Instagram: quem comenta uma palavra-chave num post recebe o material por Direct e uma resposta pública. Uma pessoa por instalação.

**Quem abre esta pasta normalmente não é dev.** Fale em português simples, um passo por vez, e faça você mesmo tudo o que for comando. Só peça à pessoa o que exige o navegador ou a conta dela (criar contas, clicar no painel da Vercel, aprovar login).

Docs técnicos: `.claude/docs/README.md` (como funciona), `.claude/docs/DEPLOY.md` (publicar na Vercel), `.claude/docs/PRD.md` (requisitos), `.claude/docs/SECURITY.md`.

@docs/AGENTS.md

## Regras

- **Nunca mostre valores de segredos** (chaves, URLs do banco, tokens). Para conferir, liste só nomes.
- **Nunca peça a senha do painel no chat.** O `pnpm configurar` gera uma senha provisória; a pessoa troca em Configurações › Segurança.
- A chave da Zernio a pessoa pode colar no chat: passe direto para o `pnpm configurar` e não repita o valor.
- Para trazer variáveis da Vercel use **`pnpm env:pull`**, nunca `vercel env pull` direto (ele apaga o `PUBLIC_URL` do túnel).
- O Vercel CLI já vem no projeto: use `pnpm exec vercel …`. Não instale global.
- Não rode `pnpm db:roles` à toa: ele troca as senhas do banco e a produção precisa de novo deploy.
- `.env.local` nunca vai para o git.

## Primeiro passo: descobrir em que ponto a pessoa está

Confira nesta ordem e comece pelo primeiro item que falta:

| Confira | Se faltar |
|---|---|
| `node -v` mostra 24 ou mais | Etapa 1 |
| pasta `node_modules` existe | `pnpm install` (se `pnpm` não existir: `corepack enable pnpm`, ou `npm i -g pnpm`) |
| `.vercel/project.json` existe | Etapa 2 |
| Neon e Upstash conectados (`pnpm exec vercel env ls` mostra `DATABASE_URL` e `KV_REST_API_URL`) | Etapa 3 |
| `.env.local` tem `DATABASE_URL_WEB` | Etapa 4 e 5 |
| tudo acima ok | Etapa 6 (usar) |

Antes de começar, diga à pessoa quantas etapas faltam e quanto tempo levam (do zero: uns 20–30 minutos).

## Etapa 1 — Node.js

Se `node -v` falhar ou for menor que 24: peça para baixar a versão **LTS** em https://nodejs.org, instalar como qualquer programa e reabrir o app do Claude. Depois `corepack enable pnpm` e `pnpm install`.

## Etapa 2 — Vercel (conta e projeto)

1. A pessoa cria uma conta grátis em https://vercel.com/signup (plano Hobby).
2. Rode `pnpm exec vercel login`. Ele mostra um link: peça para a pessoa abrir e aprovar. Se travar esperando, peça que ela rode no terminal `pnpm exec vercel login`.
3. Rode `pnpm exec vercel link --yes --project mini-manychat` (cria o projeto se não existir).

## Etapa 3 — Banco (Neon) e Redis (Upstash) pela Vercel

Guie a pessoa no navegador, um item por vez:

1. Abrir https://vercel.com/dashboard → projeto **mini-manychat** → aba **Storage**.
2. **Create Database → Neon (Serverless Postgres)** → plano grátis → região **São Paulo (sa-east-1)** → criar → em "Connect Project" deixar marcados Development, Preview e Production → Connect.
3. Voltar em **Storage → Create Database → Upstash (Redis)** → plano grátis → região **São Paulo** → criar → conectar ao projeto do mesmo jeito.
4. Opcional, para enviar imagens no Direct: **Storage → Create → Blob** → conectar ao projeto. Sem ele, o material só pode ser link.

Confira com `pnpm exec vercel env ls` que apareceram `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `KV_REST_API_URL` e `KV_REST_API_TOKEN`.

## Etapa 4 — Zernio (Instagram)

A Zernio é quem conversa com o Instagram (não precisa criar app na Meta).

1. Conta do Instagram precisa ser **Profissional** (Criador de conteúdo ou Empresa).
2. Criar conta em https://zernio.com e conectar o Instagram no painel dela.
3. No painel da Zernio → **API Keys** → criar chave com **leitura e escrita** → colar aqui no chat.
4. Perguntar qual e-mail a pessoa quer usar para entrar no painel.

## Etapa 5 — Configurar tudo

```bash
pnpm configurar --email <email> --zernio <chave>
```

Ele grava e-mail e chave na Vercel, gera os segredos, cria as tabelas e a segurança do banco, cria a conta com o @ do Instagram e confere tudo. Leva 1–2 minutos. Se a Zernio tiver mais de uma conta Instagram, o erro lista os IDs: pergunte qual usar e rode de novo com `--conta <ID>`.

No fim ele mostra uma **senha provisória**: entregue à pessoa e diga para trocar logo após entrar.

## Etapa 6 — Usar

1. Rode `pnpm dev` em segundo plano e peça para abrir http://localhost:3000.
2. Primeiro login: e-mail + senha provisória → o painel pede o **2FA** (app autenticador no celular: Google Authenticator, 1Password, Authy). Peça para guardar os códigos de backup.
3. Trocar a senha em **Configurações › Segurança**.

### Receber comentários de verdade no computador (teste)

O Instagram precisa de um endereço público. No computador isso é feito com um túnel, que só funciona **enquanto o computador e o `pnpm dev` estiverem ligados**. Para funcionar 24 h, siga o `DEPLOY.md`.

1. Instalar o `cloudflared` (Mac: `brew install cloudflared`; sem Homebrew ou no Windows: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Rode `pnpm tunel` em segundo plano e pegue a URL `https://….trycloudflare.com` da saída.
3. `pnpm zernio:webhook <url> --local` e reinicie o `pnpm dev`.
4. Criar uma automação no painel e comentar a palavra-chave **de outra conta** (comentários da própria conta são ignorados de propósito).

A URL do túnel muda a cada vez: repita os passos 2–3 sempre que reabrir.

## Publicar (24 h no ar)

Siga `.claude/docs/DEPLOY.md` com a pessoa. As variáveis já estão na Vercel desde a etapa 5; falta subir o código, definir `APP_URL` e apontar o webhook da Zernio para o endereço de produção.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `Variáveis de ambiente inválidas` ao abrir | `.env.local` desatualizado: `pnpm env:pull` |
| `A Zernio recusou a chave` | chave errada ou sem escrita: criar outra com leitura e escrita |
| `Nenhuma conta Instagram ativa na Zernio` | conectar o Instagram no painel da Zernio |
| Comentário não gera Direct | webhook apontando para túnel antigo (refazer `pnpm zernio:webhook`), automação desligada, ou comentário feito pela própria conta |
| Esqueceu a senha | `/login/esqueci` com código 2FA, ou `pnpm trocar-senha` (a pessoa digita a senha nova no terminal) |
| Perdeu o celular do 2FA | usar um código de backup no login |
