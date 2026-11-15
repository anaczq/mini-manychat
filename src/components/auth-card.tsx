import clsx from "clsx";
import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

type Etapa = { marca: string; titulo: string; texto: string };

/** Painel do Nooi ao lado do formulário (Figma "Painel Nooi"). No celular vira o "Topo Nooi". */
const PAINEIS = {
  acesso: {
    pose: "/marca/nooi-ola.png",
    eyebrow: "Nooi Reply · Instagram",
    eyebrowCurto: "Nooi Reply",
    titulo: "Comentou a palavra, recebeu no Direct.",
    tituloCurto: "Comentou, recebeu no Direct.",
    texto: "O Nooi responde o comentário em público e manda o material no Direct, sozinho, 24 horas por dia.",
    etapas: [
      { marca: "bg-ink", titulo: "Comentário", texto: "alguém comenta a palavra-chave no seu post" },
      { marca: "bg-primary", titulo: "Resposta pública", texto: "“Te mandei no Direct!”" },
      { marca: "bg-success", titulo: "Direct", texto: "mensagem + link do material" },
    ],
  },
  recuperar: {
    pose: "/marca/nooi-pensando.png",
    eyebrow: "Recuperar acesso · 2FA",
    eyebrowCurto: "Recuperar acesso",
    titulo: "Esqueceu? O Nooi segura as pontas.",
    tituloCurto: "Esqueceu? O Nooi segura as pontas.",
    texto: "Suas automações seguem respondendo enquanto você troca a senha. Só precisa do código do app autenticador.",
    etapas: [
      { marca: "01", titulo: "Código 2FA", texto: "do seu app autenticador" },
      { marca: "02", titulo: "Senha nova", texto: "pelo menos 8 caracteres" },
      { marca: "03", titulo: "Entrar de novo", texto: "com a senha nova" },
    ],
  },
} satisfies Record<string, { pose: string; eyebrow: string; eyebrowCurto: string; titulo: string; tituloCurto: string; texto: string; etapas: Etapa[] }>;

function Rodape() {
  return (
    <p className="eyebrow flex items-center gap-1.5">
      <ShieldCheck className="size-3.5" aria-hidden /> Acesso restrito · 2FA obrigatório
    </p>
  );
}

/** Layout das telas de acesso (Figma "01 · Login"): formulário à esquerda e painel do Nooi à direita. */
export function AuthScreen({
  eyebrow,
  title,
  subtitle,
  painel = "acesso",
  children,
  footer = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  painel?: keyof typeof PAINEIS;
  children: ReactNode;
  footer?: boolean;
}) {
  const p = PAINEIS[painel];
  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-bg p-4 lg:h-dvh lg:min-h-[640px] lg:flex-row">
      <section className="flex items-center gap-3.5 rounded-3xl bg-primary-soft p-5 lg:hidden">
        <Image src={p.pose} alt="" width={76} height={76} priority className="size-[76px] shrink-0 object-contain" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="eyebrow text-primary">{p.eyebrowCurto}</p>
          <p className="font-display text-xl leading-[1.15] font-medium">{p.tituloCurto}</p>
        </div>
      </section>

      <div className="flex flex-col rounded-3xl border border-hairline bg-surface p-6 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:rounded-[28px] lg:px-12 lg:py-10">
        <div className="hidden items-center gap-2.5 lg:flex">
          <Image src="/marca/nooi.png" alt="" width={32} height={32} className="size-8 object-contain" />
          <span className="font-display text-lg font-medium">Nooi Reply</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center lg:py-10">
          <div className="flex w-full max-w-[400px] flex-col gap-6">
            <header className="flex flex-col gap-2">
              <p className="eyebrow text-primary">{eyebrow}</p>
              <h1 className="font-display text-[26px] leading-tight font-medium md:text-[32px]">{title}</h1>
              {subtitle && <p className="text-sm leading-[1.45] text-muted">{subtitle}</p>}
            </header>
            {children}
          </div>
        </div>
        {footer && (
          <div className="hidden lg:block">
            <Rodape />
          </div>
        )}
      </div>

      {footer && (
        <div className="flex justify-center pt-2 lg:hidden">
          <Rodape />
        </div>
      )}

      <aside className="hidden shrink-0 flex-col justify-between gap-8 overflow-hidden rounded-[28px] bg-primary-soft p-12 lg:flex lg:w-[min(620px,45%)]">
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-primary">{p.eyebrow}</p>
          <p className="font-display text-[40px] leading-[1.1] font-medium">{p.titulo}</p>
          <p className="text-base leading-normal text-secondary">{p.texto}</p>
        </div>
        <Image src={p.pose} alt="" width={220} height={220} priority className="mx-auto size-[min(220px,22vh)] object-contain" />
        <ol className="flex flex-col gap-2">
          {p.etapas.map((e: Etapa) => (
            <li key={e.titulo} className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3.5">
              {e.marca.startsWith("bg-") ? (
                <span className={clsx("size-2 shrink-0 rounded-full", e.marca)} />
              ) : (
                <span className="font-mono text-[11px] text-primary">{e.marca}</span>
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{e.titulo}</span>
                <span className="text-xs text-muted">{e.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm outline-none transition-shadow placeholder:text-tertiary/70 focus:border-primary focus:ring-4 focus:ring-primary/12";

export function Field({ label, className, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      <input className={clsx(inputClass, className)} {...props} />
    </label>
  );
}

/** Classes do campo, para quem precisa montar um input próprio (ex.: senha com o olhinho). */
export function fieldInputClass(className?: string) {
  return clsx(inputClass, className);
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] font-medium text-warning">
      {children}
    </p>
  );
}

/** Botão principal das telas de acesso: pílula cheia, 44 px. */
export const authButton = "h-11! w-full text-sm! disabled:bg-subtle disabled:text-tertiary disabled:opacity-100!";
