# Publicar o Mini Manychat (GitHub + Vercel)

Com o app publicado, ele responde comentários 24 h por dia, sem depender do seu computador.

**Antes:** termine a configuração local (`pnpm configurar` rodou e você já entrou no painel em `localhost:3000`). As variáveis já estão na Vercel; aqui falta só o código e o endereço.

**Tempo:** uns 15 minutos. **Custo:** zero no plano Hobby da Vercel e nos planos grátis do Neon e da Upstash.

> Usando o app do Claude? Diga "quero publicar" e ele faz os comandos. Você só aprova os logins no navegador e clica no painel da Vercel.

## 1. Conferir o código no seu GitHub

O seu repositório privado `mini-manychat` já existe: você o criou pelo **Use this template** e clonou pelo GitHub Desktop (veja o `README.md` na raiz). Se mudou algum arquivo, envie antes de publicar: no GitHub Desktop, **Commit to main → Push origin**.

Confira que o `.env.local` **não** aparece na lista de mudanças do GitHub Desktop (ele fica de fora pelo `.gitignore`).

## 2. Ligar o GitHub ao projeto na Vercel

Pelo painel: Vercel → projeto **mini-manychat** → **Settings → Git → Connect Git Repository** → GitHub → se pedir, **Install** o app da Vercel no GitHub e libere o repositório `mini-manychat` → escolha `mini-manychat`.

Ou pelo terminal (precisa do repositório já liberado para a Vercel no GitHub):

```bash
pnpm exec vercel git connect
```

Daqui em diante, todo `git push` publica sozinho. Para o primeiro deploy: Vercel → **Deployments** → aguarde o build ficar **Ready** (2–3 min). Se não começou, publique direto pelo terminal:

```bash
pnpm exec vercel deploy --prod
```

## 3. Definir o endereço do app

1. Vercel → projeto → **Settings → Domains**: copie o domínio de produção (algo como `https://mini-manychat-xxxx.vercel.app`). Use **esse**, não a URL de um deploy específico (as URLs de deploy são protegidas e o Instagram não consegue chamar).
2. Grave como `APP_URL` na produção:
   ```bash
   pnpm env:push https://mini-manychat-xxxx.vercel.app
   ```
3. Vercel → **Deployments** → no último deploy, **⋯ → Redeploy** (a variável só vale depois de um novo deploy).

## 4. Apontar o Instagram (Zernio) para o app publicado

```bash
pnpm zernio:webhook https://mini-manychat-xxxx.vercel.app
```

Ele atualiza o webhook `mini-manychat` na Zernio e envia um evento de teste. Deve aparecer `evento de teste: entregue`.

> **Atenção:** existe um webhook só. Se depois você rodar `pnpm zernio:webhook … --local` para testar no computador, os comentários param de chegar no app publicado. Ao terminar o teste, rode de novo o comando desta etapa.

## 5. Testar

1. Abra o domínio de produção e entre com o **mesmo e-mail, senha e 2FA** do computador (os dois usam o mesmo banco).
2. Com uma automação ligada, comente a palavra-chave **de outra conta** do Instagram.
3. Em **Histórico** o comentário aparece e o Direct é enviado em segundos.

Uma vez por dia (9h UTC) um cron da Vercel refaz o que ficou parado e apaga histórico com mais de 90 dias. Não precisa configurar nada.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Build falha com `Variáveis de ambiente inválidas` | Settings → Environment Variables: confira se as variáveis existem em **Production**. Rode `pnpm configurar` de novo e faça Redeploy |
| Build falha citando `queue` ou `experimentalTriggers` | a fila da Vercel não está disponível na conta: peça ao Claude para tirar o bloco `functions` do `vercel.json` (o app processa os comentários direto, sem fila) |
| `evento de teste: falhou` | domínio errado (use o de **Domains**) ou deploy ainda não terminou |
| Login funciona no computador e não online | `APP_URL` faltando ou sem Redeploy (etapa 3) |
| Comentários pararam de chegar | o webhook ficou no túnel: refaça a etapa 4 |
| Imagens não sobem | conecte um **Blob** em Storage e faça Redeploy |
