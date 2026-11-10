import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/**
 * Seule la vitrine et les écrans d'entrée intéressent un moteur de recherche.
 * L'application est derrière une connexion : l'interdire évite d'user le budget
 * d'exploration sur des pages qui renvoient toutes vers /login.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signup", "/login"],
      disallow: [
        "/dashboard",
        "/invoices",
        "/quotes",
        "/clients",
        "/payments",
        "/products",
        "/settings",
        "/support",
        "/abonnement",
        "/onboarding",
        "/auth",
        "/reset-password",
        "/f/",
        "/forgot-password",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
