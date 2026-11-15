# Mini Manychat

Responde comentários do Instagram sozinho: quem comenta a palavra-chave num post ou reel recebe o material por **Direct** e uma resposta pública no comentário. Painel próprio, na sua conta da Vercel, sem mensalidade de ferramenta de automação.

**Não precisa saber programar.** O Claude faz a instalação com você, um passo por vez. Do zero leva uns 30–40 minutos.

## O que você precisa

| Item | Custo |
|---|---|
| App do **Claude** com Claude Code (https://claude.ai/download) | plano pago do Claude (Pro ou superior) |
| Conta no **GitHub** (https://github.com/signup) | grátis |
| Conta na **Vercel** (https://vercel.com/signup), plano Hobby | grátis |
| Conta na **Zernio** (https://zernio.com), que conecta o Instagram | veja os planos no site |
| Instagram **profissional** (Criador de conteúdo ou Empresa) | grátis |
| App autenticador no celular (Google Authenticator, Authy, 1Password) | grátis |

O banco de dados (Neon) e o Redis (Upstash) são criados pela própria Vercel, nos planos grátis.

## Comece aqui

1. Nesta página do GitHub, clique em **Use this template → Create a new repository**.
   - Dê o nome `mini-manychat` e marque **Private**.
   - Clique em **Create repository**.
2. Instale o **GitHub Desktop** (https://desktop.github.com) e entre com a sua conta do GitHub.
3. No GitHub Desktop: **File → Clone repository** → escolha o `mini-manychat` que você acabou de criar → **Clone**.
4. Abra o app do Claude → **Claude Code** → abra a pasta `mini-manychat` que o GitHub Desktop criou (no Mac fica em `Documentos/GitHub/mini-manychat`; no Windows, em `Documentos\GitHub\mini-manychat`).
5. Escreva no chat: **quero configurar**.

O Claude confere o que já existe, diz quantas etapas faltam e faz todos os comandos. Você só cria as contas e aprova os logins no navegador.

Depois de configurado, diga **quero publicar** para o app ficar no ar 24 h por dia.

## Depois de instalado

| Diga ao Claude | O que acontece |
|---|---|
| `quero configurar` | instalação do zero, ou continua de onde parou |
| `quero publicar` | coloca o app no ar 24 h (Vercel) |
| `quero atualizar` | traz a versão mais nova do Mini Manychat |
| `não está respondendo os comentários` | o Claude investiga e corrige |

## Documentação técnica

Fica em [`.claude/docs`](.claude/docs/README.md): como funciona, publicação, requisitos e segurança.

## Licença

Grátis para uso pessoal, nas suas próprias contas do Instagram. É proibido revender ou redistribuir o código e instalar para clientes ou terceiros sem licença comercial. Veja [`LICENSE`](LICENSE).
