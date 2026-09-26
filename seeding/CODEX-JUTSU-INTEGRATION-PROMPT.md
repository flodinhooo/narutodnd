# Codex Task — Jutsu Master Seed + Provenance + DM Custom Jutsu

Work against the CURRENT repository state. Inspect the existing Prisma schema, migrations, seed architecture, campaign authorization helpers, Jutsu library routes, DM Workshop/Jutsu UI, tests, and conventions before changing anything. Preserve all existing campaign access/security behavior.

## Goal
Integrate the supplied generated Jutsu datasets into the existing shared Jutsu system. Canon Naruto techniques, Shio homebrew, foundation techniques, Uzumaki techniques, and campaign-specific DM-created techniques must all remain normal `Jutsu` records, but their provenance and scope must be distinguishable.

## Supplied data files
- `jutsu-seed-types.generated.ts`
- `jutsu-homebrew-elemental.generated.ts`
- `jutsu-canon.generated.ts`
- `jutsu-foundation.generated.ts`
- `jutsu-uzumaki.generated.ts`
- `jutsu-character-signatures.generated.ts`
- `JUTSU-SEED-AUDIT.generated.md`
- optional audit source: `jutsu-master.cleaned.generated.json`

Treat `rawMarkdown` as source/audit material, not necessarily a database column. Map structured fields where possible and preserve unusual mechanics in description/mechanics text rather than silently discarding them.

## Data model requirements
1. Add a typed provenance/origin concept for Jutsu. Required values: `CANON`, `SHIO_HOMEBREW`, `FOUNDATION`, `DM_CUSTOM`.
2. Preserve a separate pool/category concept where useful: `ELEMENTAL`, `CANON`, `FOUNDATION`, `UZUMAKI`, `CHARACTER_SIGNATURE`. Do NOT conflate provenance with progression type. In the source files, `Foundation` can mean “start of an evolution branch” while still being Shio homebrew.
3. Support Jutsu prerequisites/evolution relationships. Prefer a proper self-relation / prerequisite model over storing only display text, but retain unresolved prerequisite text when a target cannot be resolved safely.
4. Existing `JutsuChakraNature` already supports multiple nature links. Keep that capability.
5. Add special ChakraNature keys as needed, at minimum `NIKKOTON` and `IRON_RELEASE`.
   - NIKKOTON is a resulting special nature requiring FIRE + LIGHTNING.
   - IRON_RELEASE is Raizen's self-developed Kekkei-Tōta-like Iron Release requiring WATER + EARTH + FIRE.
   Do not model the component requirements as if every Iron Release jutsu were simultaneously an ordinary Water/Earth/Fire jutsu if the UI/domain would become misleading. If needed, introduce explicit required-nature metadata/relations.
6. Uzumaki records may carry tradition provenance: `Überliefert`, `Rekonstruiert`, `Shiogakure`. Preserve it separately from global Jutsu origin.
7. DM-created Jutsu must be campaign-scoped. Global seeded Jutsu have no campaign owner. DM custom Jutsu must reference exactly one campaign and use origin `DM_CUSTOM`.
8. Do not add `createdBy` unless the current domain actually has a stable user/account identity that can support it.
9. Design uniqueness so global seeded Jutsu remain idempotent while two different campaigns may create similarly named custom Jutsu. Existing global slugs must not collide with campaign custom records.

## Seed behavior
- Replace/extend the current tiny demo seed with modular idempotent seed modules using the supplied datasets.
- Re-running the seed must not duplicate Jutsu, natures, nature links, prerequisites, or evolution relations.
- Canon provenance wins where an identical real Naruto technique appeared in both the elemental homebrew file and Canon source; the generated datasets have already removed the 9 known collisions. Do not reintroduce them.
- Preserve existing database records where possible; do not reset the database just to make the migration easy.
- Resolve prerequisite/evolution links in a second pass after Jutsu upserts so ordering does not break relations.
- Log useful counts by source/pool and unresolved prerequisites.

## Character-signature dataset
These are geranked Jutsu discovered from Ayame, Kaito, Ren, Renji, and Raizen sheets that were missing from the main pools. Seed them as global Shio homebrew Jutsu, NOT as campaign-owned DM custom records.

Do not turn ordinary combat actions/traits into Jutsu. In particular, unranked character actions such as normal Katana attacks, ANBU attack actions, companion combos, and analysis traits should stay out unless the current domain explicitly models them as Jutsu. Follow `JUTSU-SEED-AUDIT.generated.md`.

## DM UI — custom Jutsu creator
Extend the existing DM Jutsu experience rather than building an unrelated parallel admin system.

Add an “Eigenes Jutsu erstellen” flow/overlay accessible only to a DM for the current campaign. It should support at least:
- Name
- optional German / English / Japanese names if the existing UI benefits from them
- Rank E–S
- category/type
- one or more Chakra natures, including special natures
- Chakra cost
- action type
- range
- duration / concentration
- attack type or save ability
- damage dice/type when applicable
- description/mechanics
- optional prerequisites/evolution parent(s)
- player-library visibility if the existing library visibility model supports it

Allow the DM to edit and delete campaign-owned custom Jutsu. Never allow mutation/deletion of global seeded Jutsu through this custom-Jutsu UI.

Campaign custom Jutsu must be usable anywhere a normal Jutsu is usable within the same campaign: character assignment, DM workshop, campaign Jutsu library, prerequisite/evolution display. They must never leak into another campaign.

## Authorization / security
All create/update/delete operations must perform server-side DM authorization using the existing campaign session/access mechanism. Do not rely on hidden buttons alone.

Validate every referenced campaign, Jutsu, nature, prerequisite and character server-side. Prevent cross-campaign ID injection: a DM in campaign A must not edit, delete, assign, or link a DM_CUSTOM Jutsu owned by campaign B.

Players must remain read-only and only see custom Jutsu when the existing campaign/library visibility rules allow them to.

## UI filtering
Where the Jutsu library/listing supports filters, expose understandable source filters such as:
- Alle
- Canon
- Eigene / Shio
- Grundlagen
- Kampagnen-Jutsu

Uzumaki can be an additional pool/tradition filter rather than pretending it is a separate global provenance.

## Migration compatibility
Create a normal Prisma migration. Existing Jutsu rows must receive a safe default/backfill without destructive reset. Inspect existing seeded/demo data before deciding the exact backfill value.

## Tests
Add focused regression coverage for at least:
- seed is idempotent
- expected source/pool metadata survives seeding
- Canon collision is not duplicated
- NIKKOTON and IRON_RELEASE exist and their component requirements are represented correctly
- prerequisite/evolution resolution
- DM can create/update/delete a custom Jutsu in own campaign
- player cannot create/update/delete
- DM cannot mutate another campaign's custom Jutsu
- campaign A custom Jutsu is not exposed/assignable in campaign B
- global Jutsu remain usable across campaigns
- campaign custom Jutsu can be assigned to a character in the same campaign
- foreign-campaign custom Jutsu cannot be assigned
- source filters do not break existing library behavior

## Verification
Run and report:
- `npx prisma validate`
- migration/generate steps required by the repo
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Do not weaken existing tests or authorization to make the new work pass. At the end, summarize schema changes, migration/backfill behavior, seeded counts, unresolved source-data ambiguities, UI changes, tests added, and verification results.
