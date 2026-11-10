import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("commence par le BOM et sépare par point-virgule", () => {
    const csv = toCsv(["A", "B"], [[1, "x"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿A;B\r\n1;x\r\n");
  });

  it("protège les guillemets, points-virgules et retours à la ligne", () => {
    expect(toCsv(["A"], [['Hama; "Frères"']])).toContain('"Hama; ""Frères"""');
  });

  it("neutralise une formule cachée dans un texte", () => {
    expect(toCsv(["A"], [["=HYPERLINK(1)"]])).toContain("'=HYPERLINK(1)");
  });

  it("laisse les nombres négatifs intacts", () => {
    expect(toCsv(["A"], [[-500]])).toContain("\r\n-500\r\n");
  });

  it("rend les valeurs absentes vides", () => {
    expect(toCsv(["A", "B"], [[null, undefined]])).toContain("\r\n;\r\n");
  });
});
