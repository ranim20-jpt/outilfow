import "./globals.css";
import type { Metadata } from "next";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "OutilFlow — Quincaillerie Bochtiba",
  description: "Plateforme web de vente en gros et au détail, gestion et livraison.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Header />
        <main className="container">{children}</main>
        <footer className="footer">OutilFlow · Quincaillerie Bochtiba · prix en dinars tunisiens (DT), hors TVA</footer>
      </body>
    </html>
  );
}
