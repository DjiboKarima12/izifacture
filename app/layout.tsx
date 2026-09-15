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
 * Applique clair/sombre, la palette et la taille de texte AVANT le premier rendu.
 *
 * Sans ce script, la page s'afficherait une fraction de seconde dans les
 * réglages par défaut avant de basculer à l'hydratation — un clignotement
 * d'autant plus voyant que l'écart est grand entre « Papier » clair et
 * « Ardoise » sombre.
 *
 * Chaque réglage est lu dans son propre `try` : une préférence corrompue ne doit
 * pas empêcher les autres de s'appliquer. Et tout est enveloppé, car
 * `localStorage` lui-même lève une exception en navigation privée sur certains
 * navigateurs — l'application doit s'ouvrir quand même.
 */
const THEME_SCRIPT = `
try {
  var stored = localStorage.getItem('izifacture-theme');
  var dark = stored ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
try {
  var raw = localStorage.getItem('mamafacture-appearance');
  if (raw) {
    var a = JSON.parse(raw);
    var themes = ['sable','ardoise','papier','indigo','comptoir'];
    if (themes.indexOf(a.theme) > 0) document.documentElement.dataset.theme = a.theme;
    var scales = [90,100,112,125];
    if (scales.indexOf(a.textScale) > -1 && a.textScale !== 100) {
      document.documentElement.style.fontSize = a.textScale + '%';
    }
  }
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
