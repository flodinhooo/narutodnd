export const jutsuRanks = ["E", "D", "C", "B", "A", "S"] as const;
export const techniqueTypes = ["Grundlagen", "Ninjutsu", "Taijutsu", "Genjutsu", "Versiegelung", "Waffentechnik", "Medizin", "Beschwörung", "Spezialfähigkeit", "Sonstige"];
export const usageTypes = ["Angriff", "Verteidigung", "Bewegung", "Kontrolle", "Unterstützung", "Wahrnehmung"];

export function plainJutsuText(text: string) {
  return text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*`_]/g, "").replace(/^\s*#{1,6}\s*/gm, "").replace(/\r/g, "").trim();
}

const editorialBoundary = /^(?:#{1,6}\s*)?(?:Zusammenfassung|Implementierungsregeln|Ergänzte Übersicht|Lernprogression für junge Uzumaki|DM-Hinweise|Sora und Yuna|Verbotene Uzumaki-Techniken|Die vier Standalones|Neue [A-S]-Rank-Foundations|Jetzt kommen vier neue|[CABS]-Rang$|30\.2 Hanzō|.*(?:Katon|Suiton|Fūton|Raiton|Doton)\s*[–-]\s*[EDCBAS]-Rang)/iu;
const metadata = /^(?:[-•]\s*)?\*{0,2}(?:DE|EN|JP|Rang|Level|Kategorie|Typ|Benötigtes Jutsu|Bekannte Nutzer|Zugang|Herkunft|Quelle|Entwicklung|Tradition|Chakra|Aktion|Reichweite|Dauer)\s*:/iu;

export function cleanJutsuDescription(raw: string) {
  const lines = raw.replace(/\r/g, "").split("\n");
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (editorialBoundary.test(line)) break;
    if (/^#{1,6}\s*\d+[.)]?\s+/.test(line) || /^---+$/.test(line)) continue;
    if (/Hier können wir später|Hier kommt ein Pfad rein|den ich bei .*unbedingt haben will|Damit unterscheidet sich|Besonders passend für|^[🌪️⚡ ]*\*\*(?:Fūton|Raiton)-Waffe:/iu.test(line)) continue;
    const mechanic = line.match(/^(?:[-•]\s*)?\*{0,2}Mechanik:\*{0,2}\s*(.*)$/iu);
    if (mechanic) { result.push(plainJutsuText(mechanic[1])); continue; }
    if (metadata.test(line)) continue;
    result.push(plainJutsuText(line));
  }
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function jutsuSummary(description: string) {
  const body = cleanJutsuDescription(description).replace(/\s+/g, " ");
  if (!body) return "Für diese Technik ist noch keine geprüfte Wirkungsbeschreibung vorhanden.";
  const sentences = body.match(/.*?[.!?](?:\s|$)/g);
  const short = sentences?.slice(0, 2).join(" ").trim() || body;
  return short.length > 260 ? `${short.slice(0, 257).replace(/\s+\S*$/, "")}…` : short;
}

export function techniqueType(category: string | null | undefined) {
  const value = category || "";
  if (/foundation|grundlagen/i.test(value)) return "Grundlagen";
  if (/medical|medizin/i.test(value)) return "Medizin";
  if (/fūinjutsu|fuinjutsu|seal|versiegel/i.test(value)) return "Versiegelung";
  if (/genjutsu/i.test(value)) return "Genjutsu";
  if (/kenjutsu|bukijutsu|shuriken|kugutsu/i.test(value)) return "Waffentechnik";
  if (/taijutsu|eight gates/i.test(value)) return "Taijutsu";
  if (/summon|beschwör/i.test(value)) return "Beschwörung";
  if (/kekkei genkai|rinnegan|jinch|bijū|jujutsu|jiongu|eight gates/i.test(value)) return "Spezialfähigkeit";
  if (/legendary weapon|sage tool/i.test(value)) return "Waffentechnik";
  if (/regeneration/i.test(value)) return "Medizin";
  if (/barrier|sand|explosion|chakra control|magnet release|shikotsumyaku|eisenversteck/i.test(value)) return "Ninjutsu";
  if (/ninjutsu|katon|suiton|doton|raiton|fūton|hyōton|mokuton|hiden|sensor/i.test(value)) return "Ninjutsu";
  return "Sonstige";
}

export function jutsuUsages(j: {category?: string | null; description?: string; damageDice?: string | null; attackType?: string | null}) {
  const text = `${j.category || ""} ${cleanJutsuDescription(j.description || "")}`;
  const result: string[] = [];
  if (j.damageDice || j.attackType || /damage|schaden|offense|angriff|projectile|finisher/i.test(text)) result.push("Angriff");
  if (/defen|verteidig|rüstung|\bac\b|schild|schütz|schutz|barrier/i.test(text)) result.push("Verteidigung");
  if (/movement|speed|beweg|teleport|schritt|burrow|flieg/i.test(text)) result.push("Bewegung");
  if (/restraint|control|gefesselt|festhalt|terrain|verlangsamt|kontroll/i.test(text)) result.push("Kontrolle");
  if (/sensor|detect|tracking|wahrnehm|aufspür|erkenn/i.test(text)) result.push("Wahrnehmung");
  if (/heal|heil|regener|unterstütz|verstärk|utility|clone|doppelgänger/i.test(text)) result.push("Unterstützung");
  return result;
}

export const actionLabel = (value: string) => ({Action: "Aktion", "Bonus Action": "Bonusaktion", Reaction: "Reaktion", Self: "Selbst", Instantaneous: "Sofort"}[value] || plainJutsuText(value));
export const jutsuTitle = (j: {name: string; germanName?: string | null}) => j.germanName || j.name;

export function auditJutsuSource(raw: string) {
  const names = [...raw.matchAll(/^(?:[-•]\s*)?\*\*DE:\*\*\s*(.+)$/gm)].map(m => m[1].trim());
  const techniqueBlocks = raw.split(/(?=^#{1,6}\s+)/m).filter(block => /^#{1,6}\s+/.test(block) && /\*\*(?:DE|JP|Rang):\*\*/.test(block));
  return names.length > 1 || techniqueBlocks.length > 1 ? ["Mehrere Techniknamen in einem Import: manuelle Trennung erforderlich."] : [];
}
