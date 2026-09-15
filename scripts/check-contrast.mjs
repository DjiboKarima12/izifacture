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
  ["sable    · texte atténué sur fond    ", hsl(35, 13, 38), hsl(37, 36, 90)],
  ["sable    · texte principal sur fond  ", hsl(35, 31, 11), hsl(37, 36, 90)],
  ["sable    · nav au repos sur la barre ", hsl(34, 22, 63), hsl(28, 28, 13)],
  ["sable    · « MF » sur la pastille    ", hsl(28, 28, 13), hsl(36, 67, 55)],
  ["ardoise  · texte atténué sur fond    ", hsl(215, 12, 40), hsl(214, 20, 94)],
  ["ardoise  · nav au repos sur la barre ", hsl(215, 12, 65), hsl(220, 16, 14)],
  ["papier   · texte atténué sur fond    ", hsl(45, 6, 38), hsl(45, 18, 94)],
  ["papier   · « MF » sur la pastille    ", hsl(45, 30, 97), hsl(18, 62, 43)],
  ["indigo   · texte atténué sur fond    ", hsl(224, 14, 40), hsl(222, 30, 95)],
  ["indigo   · « MF » sur la pastille    ", hsl(226, 38, 15), hsl(40, 68, 61)],
  ["comptoir · texte atténué sur fond    ", hsl(160, 10, 36), hsl(158, 20, 94)],
  ["comptoir · « MF » sur la pastille    ", hsl(160, 46, 13), hsl(38, 62, 58)],
  ["statut   · « payée » sur son fond    ", hsl(158, 64, 30), hsl(152, 62, 96)],
  ["statut   · « en retard » sur le sien ", hsl(0, 72, 49), hsl(0, 100, 97)],

  // La carte « Gratuit » de la vitrine vit sur --sidebar-active, six points
  // plus clair que la barre elle-même. Un texte lisible sur --sidebar ne l'est
  // pas forcément ici : l'écart au fond y est plus faible, donc on le mesure.
  ["vitrine  · texte sur carte gratuite  ", hsl(38, 83, 95), hsl(29, 27, 19)],
  ["vitrine  · mention sur carte gratuite", hsl(34, 22, 63), hsl(29, 27, 19)],
  ["vitrine  · coche or sur carte gratuit", hsl(36, 67, 55), hsl(29, 27, 19)],
  ["vitrine  · bouton sombre au survol   ", hsl(38, 83, 95), hsl(30, 28, 23)],

  ["clair  · vert     blanc sur le bouton ", hsl(0, 0, 100), hsl(158, 64, 22)],
  ["clair  · vert     texte sur pastille  ", hsl(158, 64, 22), hsl(152, 45, 94)],
  ["sombre · vert     texte sur le bouton ", hsl(224, 45, 10), hsl(158, 50, 45)],
  ["clair  · teal     blanc sur le bouton ", hsl(0, 0, 100), hsl(178, 72, 26)],
  ["clair  · teal     texte sur pastille  ", hsl(178, 72, 26), hsl(178, 44, 93)],
  ["sombre · teal     texte sur le bouton ", hsl(178, 45, 8), hsl(176, 55, 48)],
  ["clair  · bleu     blanc sur le bouton ", hsl(0, 0, 100), hsl(212, 75, 33)],
  ["clair  · bleu     texte sur pastille  ", hsl(212, 75, 33), hsl(210, 70, 94)],
  ["sombre · bleu     texte sur le bouton ", hsl(212, 45, 8), hsl(211, 78, 58)],
  ["clair  · indigo   blanc sur le bouton ", hsl(0, 0, 100), hsl(243, 55, 38)],
  ["clair  · indigo   texte sur pastille  ", hsl(243, 55, 38), hsl(243, 60, 95)],
  ["sombre · indigo   texte sur le bouton ", hsl(243, 45, 8), hsl(243, 70, 66)],
  ["clair  · violet   blanc sur le bouton ", hsl(0, 0, 100), hsl(280, 50, 36)],
  ["clair  · violet   texte sur pastille  ", hsl(280, 50, 36), hsl(280, 50, 95)],
  ["sombre · violet   texte sur le bouton ", hsl(280, 45, 8), hsl(280, 62, 66)],
  ["clair  · rose     blanc sur le bouton ", hsl(0, 0, 100), hsl(335, 60, 33)],
  ["clair  · rose     texte sur pastille  ", hsl(335, 60, 33), hsl(335, 62, 95)],
  ["sombre · rose     texte sur le bouton ", hsl(335, 45, 8), hsl(335, 68, 62)],
  ["clair  · ambre    blanc sur le bouton ", hsl(0, 0, 100), hsl(34, 80, 28)],
  ["clair  · ambre    texte sur pastille  ", hsl(34, 80, 28), hsl(40, 70, 92)],
  ["sombre · ambre    texte sur le bouton ", hsl(34, 45, 8), hsl(40, 72, 52)],
  ["clair  · ardoise  blanc sur le bouton ", hsl(0, 0, 100), hsl(215, 28, 25)],
  ["clair  · ardoise  texte sur pastille  ", hsl(215, 28, 25), hsl(215, 25, 93)],
  ["sombre · ardoise  texte sur le bouton ", hsl(215, 45, 8), hsl(213, 22, 62)],
];
for (const [nom, fg, bg] of paires) {
  const r = ratio(fg, bg);
  const verdict = r >= 4.5 ? "OK (AA texte)" : r >= 3 ? "limite (gros texte / UI)" : "INSUFFISANT";
  console.log(`${nom}  ${r.toFixed(2)}:1  ${verdict}`);
}
