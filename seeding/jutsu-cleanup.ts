import type { JutsuSeedRecord } from "./jutsu-seed-types.generated";
import { auditJutsuSource, cleanJutsuDescription, plainJutsuText } from "../src/lib/jutsu-content";

export function cleanSeedJutsu(record: JutsuSeedRecord) {
  const warnings = auditJutsuSource(record.rawMarkdown);
  const field = (label: string) => record.rawMarkdown.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*([^\\n]+)`, "i"))?.[1].split(/\s*[·|]\s*\*\*/)[0].trim();
  const sourceCategory = record.category || field("Kategorie") || (record.pool === "ELEMENTAL" && record.natures.length ? "Ninjutsu" : record.pool === "UZUMAKI" ? "Fūinjutsu" : null);
  const category = sourceCategory ? plainJutsuText(sourceCategory.split(/\s*·\s*\*\*Typ:/)[0]) : null;
  return {
    description: cleanJutsuDescription(record.description || record.rawMarkdown),
    category,
    range: plainJutsuText(record.range || field("Reichweite") || "Self"),
    duration: plainJutsuText(record.duration || field("Dauer") || "Instantaneous"),
    actionType: plainJutsuText(record.actionType || field("Aktion") || field("Mechanik")?.match(/^(Bonus Action|Reaction|Action)\b/)?.[1] || "Action"),
    reviewNeeded: warnings.length > 0,
    sourceMarkdown: record.rawMarkdown,
  };
}
