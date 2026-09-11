import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MaMaFacture",
    template: "%s · MaMaFacture",
  },
  description: "La facturation simple pour les entrepreneurs africains.",
};

/**
 * Applique le thème avant le premier rendu. Sans ce script, la page s'afficherait
 * en clair une fraction de seconde avant de basculer en sombre à l'hydratation.
 */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('izifacture-theme');
  var dark = stored ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
