import {expect, it} from "vitest";
import {auditJutsuSource, cleanJutsuDescription, jutsuSummary, techniqueType, jutsuUsages} from "./jutsu-content";
import {cleanSeedJutsu} from "../../seeding/jutsu-cleanup";
import records from "../../seeding/jutsu-master.cleaned.generated.json";
import type {JutsuSeedRecord} from "../../seeding/jutsu-seed-types.generated";

it("removes duplicated identity fields and editorial tails without losing the effect", () => {
  const r = (records as JutsuSeedRecord[]).find(r=>r.slug==="raiton-raiba-no-jutsu")!;
  const clean = cleanSeedJutsu(r);
  expect(clean.description).toContain("1d6 Lightning Damage");
  expect(clean.description).toContain("keine Opportunity Attacks");
  expect(clean.description).not.toMatch(/DE:|JP:|Standalones|Damit unterscheidet/);
  expect(clean.category).toBe("Ninjutsu");
  expect(clean.sourceMarkdown).toBe(r.rawMarkdown);
});
it("retains mechanics and nested effect headings while separating author sections", () => {
  const text = "### 1. Technik\n- **DE:** Beispiel\n- **Mechanik:** Verursacht 2d6 Schaden.\n\n## Fehlschlag\nDas Ziel ist gefesselt.\n\n# Implementierungsregeln\nGeheime Autorenhinweise.";
  const clean = cleanJutsuDescription(text);
  expect(clean).toContain("2d6 Schaden"); expect(clean).toContain("Das Ziel ist gefesselt"); expect(clean).not.toContain("Autorenhinweise");
  expect(cleanJutsuDescription(clean)).toBe(clean);
});
it("flags multiple imported technique identities instead of silently displaying a combined record", () => {
  expect(auditJutsuSource("**DE:** Erstes Jutsu\nWirkung.\n## 2. Zweites Jutsu\n**DE:** Zweites Jutsu")).toHaveLength(1);
});
it("audits all 579 sources without emptying their effects or changing identifiers", () => {
  expect(records).toHaveLength(579);
  for (const r of records as JutsuSeedRecord[]) {
    const clean = cleanSeedJutsu(r);
    expect(clean.description, r.slug).not.toBe("");
    expect(jutsuSummary(clean.description).length).toBeLessThanOrEqual(260);
    expect(clean.description, r.slug).not.toMatch(/\*\*DE:|\*\*JP:/);
  }
});
it("categorizes technique and purpose separately", () => {
  expect(techniqueType("Medical Ninjutsu")).toBe("Medizin");
  expect(techniqueType("Ninjutsu / Kenjutsu")).toBe("Waffentechnik");
  expect(jutsuUsages({category:"Ninjutsu / Movement",description:"Du bewegst dich 3 m."})).toContain("Bewegung");
});
