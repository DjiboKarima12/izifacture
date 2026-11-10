import { describe, expect, it } from "vitest";

import { CHANGELOG, pendingNews, type NewsEntry } from "@/lib/changelog";

const NEWS: NewsEntry[] = [
  {
    id: "b",
    date: "2026-11-10T00:00:00Z",
    title: "B",
    items: [{ text: "installer", unlessInstalled: true }, { text: "autre" }],
  },
  { id: "a", date: "2026-10-01T00:00:00Z", title: "A", items: [{ text: "a" }] },
];

const ANCIEN = "2026-09-01T00:00:00Z";
const PREMIUM = { premium: true, installed: false };

describe("pendingNews", () => {
  it("montre la plus récente à un abonné plus ancien qu'elle", () => {
    expect(pendingNews(null, ANCIEN, PREMIUM, NEWS)?.id).toBe("b");
    expect(pendingNews("a", ANCIEN, PREMIUM, NEWS)?.id).toBe("b");
  });

  it("est réservée au premium", () => {
    expect(pendingNews(null, ANCIEN, { premium: false, installed: false }, NEWS)).toBeNull();
  });

  it("ne la remontre pas une fois vue", () => {
    expect(pendingNews("b", ANCIEN, PREMIUM, NEWS)).toBeNull();
  });

  it("ne l'annonce pas à un compte créé après", () => {
    expect(pendingNews(null, "2026-11-10T08:00:00Z", PREMIUM, NEWS)).toBeNull();
  });

  it("ne propose pas d'installer à qui a déjà installé", () => {
    const entry = pendingNews(null, ANCIEN, { premium: true, installed: true }, NEWS);
    expect(entry?.items.map((item) => item.text)).toEqual(["autre"]);
  });

  it("n'ouvre rien quand plus aucune ligne ne le concerne", () => {
    const seule: NewsEntry[] = [
      { id: "c", date: "2026-11-10T00:00:00Z", title: "C", items: [{ text: "installer", unlessInstalled: true }] },
    ];
    expect(pendingNews(null, ANCIEN, { premium: true, installed: true }, seule)).toBeNull();
  });

  it("a des identifiants uniques", () => {
    const ids = CHANGELOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
