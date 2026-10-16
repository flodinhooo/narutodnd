import records from "../seeding/jutsu-master.cleaned.generated.json";
import type {JutsuSeedRecord} from "../seeding/jutsu-seed-types.generated";
import {cleanSeedJutsu} from "../seeding/jutsu-cleanup";
import {techniqueType} from "../src/lib/jutsu-content";
const issues: {slug: string; issue: string}[] = [];
const categories: Record<string, number> = {};
let editorialTails = 0;
for (const r of records as JutsuSeedRecord[]) {
  const clean = cleanSeedJutsu(r);
  if (!clean.description) issues.push({slug:r.slug,issue:"Leere Wirkungsbeschreibung"});
  if (clean.reviewNeeded) issues.push({slug:r.slug,issue:"Mehrere Technikidentitäten im Import"});
  const category = techniqueType(clean.category);
  categories[category] = (categories[category] || 0) + 1;
  if (/Standalones|Implementierungsregeln|Zusammenfassung|DM-Hinweise|Hier kommt ein Pfad|– [EDCBAS]-Rang/.test(r.rawMarkdown)) editorialTails++;
}
console.log(JSON.stringify({records:records.length, editorialTails, categories, issues}, null, 2));
if (issues.length) process.exitCode = 1;
