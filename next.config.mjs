import { execSync } from "node:child_process";

/**
 * Identifiant de la version : le commit Git construit.
 *
 * PAS `Date.now()` : `next build` évalue ce fichier plusieurs fois (serveur,
 * navigateur), à quelques secondes d'écart. Chaque passe figeait une heure
 * différente, le serveur et le navigateur ne s'accordaient jamais, et le
 * bandeau « Nouvelle version » s'affichait en permanence. Le commit, lui, est
 * le même à chaque évaluation.
 */
function buildId() {
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    // Sans Git, pas de comparaison possible : le bandeau reste muet.
    return "";
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // Figé dans le code AU BUILD, côté navigateur comme côté serveur. Une
    // fenêtre restée ouverte garde l'ancien ; /api/version renvoie celui du
    // serveur redémarré. S'ils diffèrent, une nouvelle version est en ligne
    // (components/layout/update-banner.tsx).
    NEXT_PUBLIC_BUILD_ID: buildId(),
  },
};

export default nextConfig;
