# Changelog

## v0.7.0
- persönliche Händlerauswahl pro anonymem Nutzerprofil ergänzt
- Händler lassen sich in Einstellungen einzeln aktivieren/deaktivieren
- „Alle aktivieren“ und „Alle deaktivieren“ ergänzt
- ausgeschaltete Händler werden aus günstigstem Preis, Preisvergleich, Preiswecker, kommenden Angeboten und Marktanzahl entfernt
- mehrere Filialen derselben Kette folgen gemeinsam der Händlerauswahl
- neue Händler sind standardmäßig aktiv, solange der Nutzer sie nicht ausschaltet
- Händlerauswahl wird lokal zwischengespeichert und mit D1 synchronisiert
- vorbereitet für spätere regionale Verfügbarkeit über Filialdaten
- Backend API v0.4.0 / D1 Schema v3


## v0.6.1
- kritischen API-Versionsbruch aus v0.6.0 behoben
- anonyme Nutzeranlage verwendet jetzt korrekt `POST /api/users`
- Nutzerprüfung verwendet jetzt `GET /api/me`
- Nutzerkennung wird korrekt über `X-Preisscan-User` gesendet
- persönliche Beobachtungsliste wird über `GET /api/me/tracked` geladen
- Produkt beobachten/entfernen und Preiswecker verwenden die neuen `/api/me/...`-Endpunkte
- Barcode-Produkte werden über `/api/me/products/ensure` gespeichert
- EAN-Zuordnung verwendet `/api/me/products/:id/gtin`
- gemeinsamer Produktkatalog und persönliche Beobachtungsliste werden beim Sync korrekt zusammengeführt
- Service-Worker-Cache auf v0.6.1 angehoben
- App-Code verwendet jetzt Network-first mit Offline-Fallback, damit Deployments nicht an altem PWA-Cache hängen bleiben


## v0.6.0
- Mehrnutzer-Architektur ergänzt
- WRITE_TOKEN vollständig aus der normalen PWA entfernt
- automatische anonyme Nutzerkennung beim ersten Backend-Kontakt
- persönliche Beobachtungsliste pro Nutzer
- persönliche Preiswecker pro Nutzer
- gemeinsamer Produktkatalog und gemeinsame Händlerpreise bleiben erhalten
- Barcode-Scan kann Produkte ohne manuelle Admin-Freigabe beobachten
- neue Nutzer starten mit den bisherigen drei Testprodukten, können sie aber unabhängig entfernen
- Einstellungen zeigen nur noch Backend- und Nutzerstatus statt eines Secret-Eingabefelds
- Service-Worker-Cache auf v0.6.0 angehoben


## v0.5.0
- Barcode-Scanner als Kernfunktion ergänzt
- großer „Barcode scannen“-Button und eigenes Scanner-Register
- Kamera-Scan für EAN-8, EAN-13, UPC-A und UPC-E
- native BarcodeDetector-Erkennung wird bevorzugt, wenn vom Browser unterstützt
- Fallback über html5-qrcode/ZXing für Browser ohne geeigneten nativen Scanner
- manuelle EAN-/GTIN-Eingabe als letzter Fallback
- gescannte EAN wird zuerst gegen die eigene Preisscan-D1-API geprüft
- vorhandene D1-Produkte ohne EAN werden nach externer Erkennung über Name + Menge abgeglichen, damit die Startprodukte nicht unnötig doppelt angelegt werden
- unbekannte EAN wird anschließend über Open Food Facts aufgelöst
- gefundene externe Produktdaten können nach Bestätigung automatisch in D1 angelegt und beobachtet werden
- bei unbekanntem Barcode kann ein Produktname manuell ergänzt und der Datensatz trotzdem angelegt werden
- externe Produktbilder können für automatisch erkannte Produkte als image_key/URL übernommen werden
- Kamera wird beim Verlassen des Scanner-Tabs sauber gestoppt
- Service-Worker-Cache auf v0.5.0 angehoben


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
