import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mini Manychat",
  description: "Automação de respostas a comentários do Instagram",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // A CSP usa nonce por requisição (proxy.ts): nenhuma página pode ser estática, senão os scripts
  // saem sem nonce e o navegador bloqueia tudo.
  await connection();
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
