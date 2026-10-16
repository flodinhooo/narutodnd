# Spieleraktionen im Charakterbogen

Der Charakterbogen enthält Inventar, Rasten, Angriffe und ein Protokoll der
letzten 20 Aktionen. Nach einer bestätigten Aktion werden die Daten neu geladen.

## Charakter zuordnen

Die Kampagne verwendet gemeinsame Spieler-Zugangscodes. Deshalb autorisiert der
Spielerzugang allein keine Änderungen an sämtlichen Charakteren.
Die Spielleitung kann jeden Charakter steuern. Spieler steuern eigene
Spielercharaktere; NPCs bleiben bei der Spielleitung.

Beim ersten Einsatz durch den bisherigen Ersteller wird die Zuordnung von der
alten Sitzung auf ein privates, HttpOnly-Gerätecookie umgestellt. Damit bleibt
die Kontrolle bei einer erneuten Kampagnenanmeldung auf demselben Gerät erhalten.
Das Cookie gilt ein Jahr. Für ein anderes Gerät, gelöschte Cookies oder einen
von der Spielleitung erstellten Charakter gibt die Spielleitung im Bogen unter
„Charakter einem Spieler zuordnen“ einen einmaligen Übernahmecode aus.
Der Spieler öffnet denselben Bogen mit dem Spielerzugang und gibt ihn dort ein.
Die Übernahme ersetzt den bisherigen Besitzer. Der Code wird nur gehasht
gespeichert und ist nach erfolgreicher Verwendung ungültig.

## Inventar

Spieler können eigene Gegenstände anlegen, bearbeiten und entfernen:
Name, Kategorie, Beschreibung, Anzahl, Gewicht je Stück und Ausrüstungsstatus.
Kategorien: Ausrüstung, Waffen, Verbrauchbares, Wertsachen und Sonstiges.
„−1“ verbraucht ein Stück; zusätzliche Heil- oder Schadenseffekte werden dabei
nicht automatisch angenommen. Ryo kann als Wertsachen-Eintrag verwaltet werden.

Kunai, Shuriken, Katana, Seil, Rationen und Ryo stehen als editierbare Vorlagen
bereit. Waffenwerte sind Spielvorschläge und im Inventar anpassbar. Die Vorlagen
werden erst durch Speichern dem jeweiligen Inventar hinzugefügt.
Eigene Waffen können Attribut, Übung, Schadenswürfel, Schadensart, Reichweite
und Werfbarkeit festlegen. Spieler und Spielleitung stimmen diese Werte ab.
Waffen erscheinen bei den Angriffen, wenn sie ausgerüstet sind und Bestand haben.

## Kampfaktionen

Angriff: W20 plus Attributmodifikator, mit Übung zusätzlich der Übungsbonus.
Vorteil nutzt den höheren, Nachteil den niedrigeren von zwei W20.
Unbewaffneter Schlag: Stärke mit Übungsbonus; Schaden 1 plus Stärke,
mindestens 0. Vorlagen für Kunai und Shuriken verwenden 1d4 Stich,
Katana 1d8 Hieb. Alle Vorlagen sind anpassbar.

„Werfen“ verbraucht ein Exemplar der gewählten Wurfwaffe. Die Bestandsänderung
und der Wurf werden gemeinsam gespeichert. Der normale Angriff verbraucht kein
Exemplar. Treffer wird am Tisch bestätigt; „Treffer: Schaden würfeln“ ermittelt
anschließend den Schaden. Eine natürliche 20 verdoppelt nur die Schadenswürfel.
Bei einer natürlichen 1 ist kein Schadenswurf verfügbar. Wiederholtes Anfordern
des Schadens für denselben Angriff liefert dasselbe gespeicherte Ergebnis.
Schaden und Trefferpunkte am Ziel verwaltet ihr weiterhin selbst.
Diese Aktionen sind unabhängig vom vorhandenen Encounter-Rundenablauf.

## Jutsu und Rast

Erlernte Jutsu bieten „Detailseite“, aufklappbare Regeln und „Einsetzen“.
Der Server prüft Charakterzuordnung, erlernte Technik und vorhandenes Chakra.
Kosten stammen aus der Datenbank und werden atomar abgezogen. Spieler können
geheime, ungeprüfte oder fremde Techniken damit nicht einsetzen. Erlernte
Jutsu-Details bleiben auch bei geschlossener allgemeiner Bibliothek zugänglich.
Angriffe und Jutsu-Einsatz sind mit 0 TP gesperrt.

Die bestehenden Rastregeln bleiben maßgeblich:

- Kurze Rast: volle TP, Chakra gemäß Regenerationsrang, schwere Verwundung weg;
  höchstens zweimal zwischen langen Rasten.
- Lange Rast: volle TP und Chakra; Rastzähler, Limit Break, schwere Verwundung
  und Todesrettungswürfe werden zurückgesetzt.

Rasten werden im Bogen vor Ausführung bestätigt.

## Speicherung und Wiederholungen

`InventoryItem` und `CharacterActivity` gehören jeweils zu einem Charakter und
werden beim Löschen dieses Charakters mit entfernt. Der Server validiert eigene
Gegenstände und würfelt mit `crypto.randomInt`. Transaktionen und eine
Charakterversion schützen Ressourcenänderungen vor gleichzeitigen Aktionen.
Anfragekennungen verhindern doppelte Buchungen bei wiederholten Requests.
Bei unklarer Netzwerkbestätigung behält die UI die Kennung für einen erneuten
Versuch, auch über ein Neuladen desselben Tabs hinweg.

Migration `20261016200000_player_character` ist für SQLite und PostgreSQL vorhanden
und bereits auf PostgreSQL angewendet. Ein privater Snapshot wurde vorher
erstellt; bestehender Charakterzustand und erlernte Jutsu sind unverändert.
Ein PostgreSQL-Schreibtest für Inventar, Aktionsprotokoll und atomaren
Chakra-Abzug wurde innerhalb einer anschließend zurückgerollten Transaktion
geprüft. 547 Tests, TypeScript, ESLint und der Produktionsbuild bestanden.
Die Website benötigt ein Deployment mit den neuen Änderungen.
