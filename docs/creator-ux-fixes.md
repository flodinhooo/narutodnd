# Creator: Fehlerbehandlung und UX

Der reproduzierte Prisma-Crash entstand durch Select-Optionen ohne expliziten `value`: beispielsweise wurde das sichtbare Reservoir-Label statt des Prisma-Enum-Werts übermittelt. Die Action vertraute diesem Wert und ließ Fehler ungefangen nach außen gelangen.

Der Creator übermittelt jetzt Enum-Keys. `createCharacter` validiert Eingaben und Nature-/Jutsu-Berechtigungen vor der Erstellung innerhalb einer Transaktion. Erwartbare Fehler liefern strukturierte deutsche Meldungen; interne Fehler werden serverseitig protokolliert und generisch beantwortet. Der Client zeigt diese über den bestehenden globalen ToastContainer, verhindert doppelte Submits und behält State und Navigation bei. Nur Erfolg löst Navigation aus. Regeneration und Kontrolle werden jetzt ebenfalls korrekt übermittelt und gespeichert.

`ChakraNature.playerSelectable` hat den sicheren Default `false`. Die additive Migration gibt ausschließlich FIRE, WATER, WIND, LIGHTNING und EARTH frei. Bestehende Nature-Zuweisungen bleiben erhalten. Loader und Action verwenden dieselbe Starting-Jutsu-Prüfung; fremde Kampagnen, S-Rang, versteckte Natures und inkonsistente Nature-Metadaten werden ausgeschlossen.

Attribute verwenden ein eigenes responsives Grid: drei Spalten am Desktop, zwei bis 900 px, eine bis 560 px. `minmax(0, 1fr)`, begrenzte Controls und umbrechende Texte vermeiden feste Mindestbreiten. Point Buy besitzt getrennte Controls, Modifier- und Kostenzeilen. Diese Struktur wurde konzeptionell für alle drei Breiten geprüft; ein echter Browser-Viewport-Test wurde nicht ausgeführt. DOM-Tests prüfen Labels, Buttons, Talentbonus und erhaltene Eingaben nach Fehlern.

Die lokale SQLite-Datenbank wurde vor Migration mit der Backup-API gesichert. Migration `20261001140000_creator_nature_visibility` wurde angewendet. Alle ursprünglichen Spalten und Datensätze in 15 Tabellen wurden danach verglichen: 3 Kampagnen und 3 Charaktere unverändert; Integrität und Foreign Keys gültig. Keine Seeds oder Resets ausgeführt.

Verifikation: 253 Tests, Prisma Validate, Lint, Typecheck und Produktionsbuild erfolgreich. Bestehende Hit-Die-, Base-/Final-Score-, HP-History- und DM-Override-Regeln bleiben unverändert.
