import type { Metadata } from "next";
import { Funnel_Display, Funnel_Sans, Space_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { connection } from "next/server";
import "./globals.css";

const funnelSans = Funnel_Sans({ variable: "--font-funnel-sans", subsets: ["latin"] });
const funnelDisplay = Funnel_Display({ variable: "--font-funnel-display", subsets: ["latin"], weight: ["500"] });
const spaceMono = Space_Mono({ variable: "--font-space-mono", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: "Nooi Reply",
  description: "Automação de respostas a comentários do Instagram",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A CSP usa nonce por requisição (proxy.ts): nenhuma página pode ser estática, senão os scripts
  // saem sem nonce e o navegador bloqueia tudo.
  await connection();
  // Tema escolhido na lua (TemaSwitch). Sem cookie, o CSS segue o tema do sistema.
  const tema = (await cookies()).get("tema")?.value;
  return (
    <html
      lang="pt-BR"
      data-theme={tema === "dark" || tema === "light" ? tema : undefined}
      className={`${funnelSans.variable} ${funnelDisplay.variable} ${spaceMono.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
