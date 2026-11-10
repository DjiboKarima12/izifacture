import { describe, expect, it } from "vitest";

import { CHANGELOG, pendingNews, type NewsEntry } from "@/lib/changelog";

const NEWS: NewsEntry[] = [
  { id: "b", date: "2026-11-10T00:00:00Z", title: "B", items: [] },
  { id: "a", date: "2026-10-01T00:00:00Z", title: "A", items: [] },
];

describe("pendingNews", () => {
  it("montre la plus récente à un compte plus ancien qu'elle", () => {
    expect(pendingNews(null, "2026-09-01T00:00:00Z", NEWS)?.id).toBe("b");
    expect(pendingNews("a", "2026-09-01T00:00:00Z", NEWS)?.id).toBe("b");
  });

  it("ne la remontre pas une fois vue", () => {
    expect(pendingNews("b", "2026-09-01T00:00:00Z", NEWS)).toBeNull();
  });

  it("ne l'annonce pas à un compte créé après", () => {
    expect(pendingNews(null, "2026-11-10T08:00:00Z", NEWS)).toBeNull();
  });

  it("a des identifiants uniques", () => {
    const ids = CHANGELOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
