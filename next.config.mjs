/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    // Identifiant de la construction, figé dans le code AU BUILD — côté
    // navigateur comme côté serveur. Une fenêtre restée ouverte garde l'ancien ;
    // /api/version renvoie celui du serveur redémarré. S'ils diffèrent, une
    // nouvelle version est en ligne (components/layout/update-banner.tsx).
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
