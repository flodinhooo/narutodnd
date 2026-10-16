# Jutsu-Bibliothek

Die Bibliothek gruppiert Techniken nach Rang E–S. Deutscher Name und kurze
Wirkung stehen auf der Karte; vollständige Spielregeln sind separat erreichbar.
Die Ergebnisliste zeigt alle passenden Techniken auf einer Seite, gruppiert
nach Rang. Suche und Filter schränken die Auswahl weiterhin ein.
Technikart und Einsatzgebiet sind unabhängige Filter. Die Einsatzgebiete werden
aus Kategorie und Regeltext abgeleitet; ohne eindeutigen Treffer bleibt die
Zuordnung leer. Unbekannte Technikarten stehen unter „Sonstige“.

## Spieler und Freigaben

Die bestehende kampagnenweite Einstellung in der DM-Verwaltung öffnet oder
schließt die Bibliothek. Innerhalb der geöffneten Bibliothek sehen Spieler nur
explizit für ihre Kampagne freigegebene oder dort bereits erlernte Techniken.
Geheime und zur Prüfung markierte Einträge bleiben verborgen. Derselbe Filter
gilt für direkte URLs, Voraussetzungen und Entwicklungspfade.

Die Spielleitung vergibt Freigaben direkt in der Bibliothek oder Detailansicht.
Neue Freigaben sind zunächst leer; es gibt keine automatische Freigabe aller
globalen Techniken. Beim Entzug einer Freigabe bleiben bereits erlernte Jutsu
bekannt. Spieler erhalten keine Originalquellen oder Autorenhinweise.

## Charaktererstellung

Stufe 1: E und D. Stufe 2–20: E, D, C, B und A. S ist ausgeschlossen.
Dies gilt für UI und Servervalidierung. Beim Absenken der Stufe entfernt die UI
unzulässige Auswahlen. Naturfreie Techniken sind grundsätzlich kompatibel;
Spezialnaturen und geheime Techniken bleiben gesperrt.
Spieler können nur bekannte oder freigegebene Techniken wählen; die Spielleitung
kann zusätzlich den geprüften Bestand nutzen. Diese Auswahl ist unabhängig
davon, ob die allgemeine Bibliotheksansicht geöffnet ist.

## Datenbereinigung

`seeding/jutsu-cleanup.ts` bereitet die vorhandenen Seed-Einträge beim Seeding auf.
IDs und Slugs bleiben erhalten, damit Charakterzuordnungen erhalten bleiben.
Original-Markdown wird getrennt für die Spielleitung aufbewahrt.
Metadaten, bekannte Autorenkommentare und nachfolgende redaktionelle Abschnitte
werden vom Wirkungstext getrennt. Mechanische Unterabschnitte wie Fehlschlag,
Erfolg oder Wasser-Interaktion bleiben erhalten.

Mehrere unterschiedliche DE-Namensblöcke markieren einen Eintrag zur Prüfung;
solche Einträge können nicht freigegeben werden. Einträge werden nicht allein
aufgrund mehrerer Überschriften automatisch geteilt: Golems und andere Techniken
enthalten legitime Unterfähigkeiten. Der Audit prüft alle 579 bestehenden Quellen:

```sh
npx tsx scripts/audit-jutsu-content.ts
```

In diesem Bestand wurden keine mehrfachen DE-Technikidentitäten gefunden.
Die Beispiele Blitzklinge und Windschneide enthielten angehängte Abschnittstitel
und Autorenkommentare. Diese sind nun vom Regeltext getrennt. Die automatische
Prüfung ersetzt keine fachliche Durchsicht jedes einzelnen Regeltexts.

## Deployment

Migration `20261016180000_jutsu_library` für PostgreSQL anwenden und danach den
aktualisierten Seed ausführen. Anschließend den neuen Code deployen. SQLite
besitzt eine entsprechende Migration für Entwicklung und Integrationstests.

Die PostgreSQL-Migration und der bereinigte Seed sind bereits eingespielt.
Abgleich danach: 579 bestehende IDs und beide Charakter-Jutsu-Zuordnungen
unverändert, keine Schemadifferenz. Der vollständige Testlauf bestand mit
517 Tests; zusätzliche Zugriffstests prüfen NPC-Geheimnisse und die vollständige Ergebnisliste.
TypeScript, ESLint und der PostgreSQL-Produktionsbuild wurden geprüft.
