/**
 * Contraste des paires de couleurs du système, calculé sur les jetons de
 * `app/globals.css`.
 *
 * Écrit après une erreur : le commentaire du jeton `--primary` annonçait 12,5:1
 * pour un rapport réel de 7,96:1. Un chiffre d'accessibilité qui vient de la
 * mémoire ne vaut rien — celui-ci se recalcule.
 *
 * Les couleurs sont recopiées ici à la main : le but est de vérifier ce que
 * l'on CROIT avoir écrit dans le CSS, donc les lire depuis le CSS ferait
 * disparaître l'erreur que le script cherche.
 *
 *   node scripts/check-contrast.mjs
 */

const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};
const lum = ([r, g, b]) =>
  [r, g, b].map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const paires = [
  ["sable    · texte atténué sur fond      ", hsl(35, 13, 38), hsl(37, 36, 90)],
  ["sable    · texte principal sur fond    ", hsl(35, 31, 11), hsl(37, 36, 90)],
  ["sable    · nav au repos sur la barre   ", hsl(34, 22, 63), hsl(28, 28, 13)],
  ["sable    · « MF » sur la pastille      ", hsl(28, 28, 13), hsl(36, 67, 55)],

  ["ardoise  · texte atténué sur fond      ", hsl(215, 12, 40), hsl(214, 20, 94)],
  ["ardoise  · nav au repos sur la barre   ", hsl(215, 12, 65), hsl(220, 16, 14)],
  ["ardoise· sombre texte atténué sur fond ", hsl(215, 12, 68), hsl(220, 16, 14)],

  ["papier   · texte atténué sur fond      ", hsl(45, 6, 38), hsl(45, 18, 94)],
  ["papier   · nav au repos sur la barre   ", hsl(45, 8, 64), hsl(60, 3, 10)],
  ["papier   · « MF » sur la pastille      ", hsl(45, 30, 97), hsl(18, 62, 43)],

  ["indigo   · texte atténué sur fond      ", hsl(224, 14, 40), hsl(222, 30, 95)],
  ["indigo   · nav au repos sur la barre   ", hsl(224, 20, 72), hsl(226, 38, 15)],
  ["indigo   · « MF » sur la pastille      ", hsl(226, 38, 15), hsl(40, 68, 61)],

  ["comptoir · texte atténué sur fond      ", hsl(160, 10, 36), hsl(158, 20, 94)],
  ["comptoir · nav au repos sur la barre   ", hsl(158, 18, 72), hsl(160, 46, 13)],
  ["comptoir · « MF » sur la pastille      ", hsl(160, 46, 13), hsl(38, 62, 58)],

  ["commun   · blanc sur primaire (bouton) ", hsl(0, 0, 100), hsl(158, 64, 22)],
  ["commun   · statut « payée »            ", hsl(158, 64, 30), hsl(152, 62, 96)],
  ["commun   · statut « en retard »        ", hsl(0, 72, 49), hsl(0, 100, 97)],
];
for (const [nom, fg, bg] of paires) {
  const r = ratio(fg, bg);
  const verdict = r >= 4.5 ? "OK (AA texte)" : r >= 3 ? "limite (gros texte / UI)" : "INSUFFISANT";
  console.log(`${nom}  ${r.toFixed(2)}:1  ${verdict}`);
}
