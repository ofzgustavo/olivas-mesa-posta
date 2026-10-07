import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Olivas Mesa Posta — Gestão",
  description: "Eventos, acervo e financeiro da Olivas Mesa Posta",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
