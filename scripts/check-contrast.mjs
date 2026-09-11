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
  ["clair  · blanc sur primaire (bouton)    ", hsl(0, 0, 100), hsl(158, 64, 22)],
  ["clair  · blanc sur primaire survolé     ", hsl(0, 0, 100), hsl(158, 64, 17)],
  ["clair  · texte accent sur fond accent   ", hsl(158, 64, 22), hsl(152, 45, 94)],
  ["clair  · texte atténué sur fond de page ", hsl(35, 13, 38), hsl(37, 36, 90)],
  ["clair  · texte atténué sur une carte    ", hsl(35, 13, 38), hsl(37, 67, 98)],
  ["clair  · texte principal sur fond de page", hsl(35, 31, 11), hsl(37, 36, 90)],
  ["clair  · statut « payée » sur son fond  ", hsl(158, 64, 30), hsl(152, 62, 96)],
  ["clair  · statut « en retard » sur le sien", hsl(0, 72, 49), hsl(0, 100, 97)],
  ["barre  · nav active sur fond actif      ", hsl(38, 83, 95), hsl(29, 27, 19)],
  ["barre  · nav au repos sur la barre      ", hsl(34, 22, 63), hsl(28, 28, 13)],
  ["barre  · nom de marque sur la barre     ", hsl(38, 83, 95), hsl(28, 28, 13)],
  ["barre  · pastille or sur la barre       ", hsl(36, 67, 55), hsl(28, 28, 13)],
  ["sombre · texte sur primaire             ", hsl(224, 45, 10), hsl(158, 50, 45)],
  ["sombre · nav au repos sur la barre      ", hsl(155, 14, 62), hsl(165, 22, 10)],
];
for (const [nom, fg, bg] of paires) {
  const r = ratio(fg, bg);
  const verdict = r >= 4.5 ? "OK (AA texte)" : r >= 3 ? "limite (gros texte / UI)" : "INSUFFISANT";
  console.log(`${nom}  ${r.toFixed(2)}:1  ${verdict}`);
}
