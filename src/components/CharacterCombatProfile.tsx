import { enemyAbilitySchema, enemyAttackSchema } from "@/lib/enemy-templates";
export default function CharacterCombatProfile({ profile }: { profile: unknown }) {
  if (!profile || typeof profile !== "object") return null;
  const data = profile as { attacks?: unknown; abilities?: unknown }, attacks = enemyAttackSchema.array().safeParse(data.attacks), abilities = enemyAbilitySchema.array().safeParse(data.abilities);
  if (!attacks.success || !abilities.success) return null;
  return <section className="panel form"><h2>Kampfprofil · DM-Entwurf</h2><p>Vorbereitete Angriffe und Sonderfähigkeiten. Komplexe Effekte werden durch die Spielleitung ausgeführt; Run-Änderungen bleiben im Encounter.</p>{attacks.data.map((a, i) => <article key={i}><h3>{a.name}</h3><p>Angriff {a.bonus >= 0 ? "+" : ""}{a.bonus} · {a.damageDice} {a.damageType} · {a.range}</p><p>{a.description}</p></article>)}{abilities.data.map((a, i) => <article key={i}><h3>{a.name}</h3><p className="people-prose">{a.description}</p></article>)}</section>;
}
