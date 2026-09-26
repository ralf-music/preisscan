# Changelog

## v0.4.1
- PWA-Installierbarkeit für Chrome/Edge korrigiert
- lokale 192×192- und 512×512-App-Icons aus dem finalen Preisscan-Logo ergänzt
- separates 512×512-Maskable-Icon mit Sicherheitsrand ergänzt
- 32×32-Browser-Favicon und 180×180-Apple-Touch-Icon ergänzt
- Manifest um vollständige Icon-Sätze und `prefer_related_applications: false` ergänzt
- Service-Worker-Cache auf v0.4.1 angehoben und neue Icons in die App-Shell aufgenommen
- kommende Backendpreise bleiben über `valid_from`/`valid_to` strikt von aktuellen Preisen getrennt
- Datumsanzeige kommender Backendangebote auf deutsches Format vereinheitlicht


## v0.4.0
- PWA mit `https://preisscan-api.ralf-music.workers.dev` verbunden
- Backend-Status im Header, Footer und in Einstellungen sichtbar
- neue Einstellungen-Seite für API-Status und lokalen WRITE_TOKEN
- WRITE_TOKEN wird nicht im Projektcode gespeichert, sondern nur lokal im Browser
- D1-Produkte werden beim Start geladen und mit dem lokalen Produktkatalog zusammengeführt
- Trackingstatus wird mit D1 synchronisiert
- neue Katalogprodukte können über `/api/products/ensure` automatisch in D1 angelegt und beobachtet werden
- Produkt entfernen synchronisiert mit der geschützten DELETE-API
- Preiswecker synchronisieren mit `tracked_products.target_price_cents`
- GTIN/EAN-Unterstützung aus der API wird in das Produktmodell übernommen
- D1-Preisbeobachtungen können aktuelle und zukünftige Preise automatisch in die bestehende UI übernehmen
- bis automatische Händlerpreise in D1 vorhanden sind, bleiben die verifizierten Preisstände aus v0.3.1 als Fallback sichtbar
- „Preise prüfen“ aktualisiert jetzt Backenddaten statt einer reinen Dummy-Meldung
- Service Worker auf v0.4.0 angehoben und API-Aufrufe von PWA-Cache ausgeschlossen


## v0.3.1
- Fehler der v0.2.0 behoben: vollständiges Projektpaket wiederhergestellt
- bekannte reale Preisstände statt leerer Mock-Daten eingebaut
- Coca-Cola Zero 1,25 l: NORMA-Angebot 0,99 € (21.09.–27.09.2026) hinterlegt
- Coca-Cola Zero 1,25 l: Lidl 1,19 € regulär und 0,99 € Lidl Plus als getrennte Preisarten hinterlegt
- Preisarten erweitert: regulär, Angebot, App-/Kundenkartenpreis und später Couponpreis
- App-/Kartenpreise werden sichtbar als solche markiert; Voraussetzungen werden angezeigt
- Preiswecker berücksichtigt auch App-/Kartenpreise
- Regel für gemeinsame Coca-Cola-Classic-/Zero-Angebote vorbereitet
- kein fest eingebauter Nutzerstandort mehr
- Referenzstandort kann beim ersten Start gesetzt, lokal gespeichert und später geändert werden
- weiter entfernte Märkte bleiben im Vergleich sichtbar und können günstigster Treffer sein
- NORMA Mannheim 68307 als konkreter Marktbereich berücksichtigt
- alle beobachteten Produkte, inklusive der bisherigen Testprodukte, können gelöscht und über die Produktsuche wieder hinzugefügt werden
- finales Preisscan-App-Logo eingebunden
- App-Logo als Browser-/PWA-Icon eingebunden
- Händlerlogos nicht mehr von externen Bildservern abhängig; lokale CSS-Markenbadges eingebaut
- Versionsnummer sichtbar im Header und Footer
- Service-Worker-Cache auf v0.3.1 angehoben

## v0.2.0
- Händlerlogos ergänzt
- Filial-/Standortbezeichnungen von Kettenlogos getrennt
- Produktbilder für die drei Startprodukte ergänzt
- Bild-Fallbacks ergänzt
- Produktsuche als Produktfamilien-Suche ergänzt
- Coca-Cola-Zero-Varianten nach Größe/Verpackung vorbereitet
- Gemischtes Hackfleisch mit 250 g, 400 g, 500 g, 600 g, 800 g und 1000 g vorbereitet
- lokale Funktion „Produkt beobachten“ ergänzt
- Grundpreislogik €/l und €/kg vorbereitet
- Service Worker auf v0.2.0 aktualisiert

## v0.1.0
- erste Produktionsbasis
