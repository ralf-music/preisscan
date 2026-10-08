# preisscan

Private PWA „Einkaufshilfe“ für Preisvergleich, Produktsuche, Preiswecker und kommende Angebote.

## Stand v0.8.3

Umgesetzt:
- responsive PWA-Oberfläche
- sichtbare Versionsnummer
- finales Preisscan-App-Logo und Browser-/PWA-Icon
- Übersicht, vollständiger Preisvergleich, Produktsuche und Preiswecker
- lokale Speicherung des Referenzstandorts
- Standort kann jederzeit geändert werden
- Standort ist keine harte Radiusgrenze; weiter entfernte günstigere Märkte bleiben sichtbar
- lokale Verwaltung beobachteter Produkte; auch Startprodukte sind löschbar
- Produktfamilien-Suche mit Größenvarianten
- Grundpreislogik €/l und €/kg
- Preiszustände: Preis vorhanden / nicht im Sortiment / Preis nicht ermittelbar / noch nicht geprüft
- mehrere Preisarten pro Händler: regulär, Angebot, App/Kundenkarte, später Coupon
- bekannte aktuelle Preisbeispiele für Coca-Cola Zero 1,25 l
- Händlerdarstellung ohne externe Logo-Abhängigkeit
- Service Worker / Offline-App-Shell

Noch nicht aktiv:
- automatische Live-Preisabfragen bei Händlern
- automatische Standort-/Entfernungsberechnung
- serverseitige Cron-Jobs
- zentrale Preis-Historie
- echte Push-Benachrichtigungen
- Cloudflare Worker / KV / D1
- Barcode-/EAN-Scanner

## Technischer Projektname
preisscan

## Sichtbarer App-Name
Einkaufshilfe


## Backend v0.8.3

API: `https://preisscan-api.ralf-music.workers.dev`

Die normale PWA benötigt keinen WRITE_TOKEN. Jede Installation erhält automatisch eine anonyme Nutzerkennung vom Worker.

Solange `price_observations` in D1 noch leer ist, nutzt die Oberfläche für bereits bekannte Preise den verifizierten lokalen Datenstand aus v0.3.1.


## PWA-Icons
Die installierbare PWA enthält lokale 192×192-, 512×512-, Maskable-, Apple-Touch- und Favicon-Dateien.


## Barcode-Scanner v0.8.3
Die PWA scannt EAN-8/EAN-13/UPC über die Kamera. Unterstützte Browser verwenden die native BarcodeDetector-API; ansonsten wird html5-qrcode 2.3.8 als Fallback geladen. Bekannte Barcodes werden in der eigenen API gesucht, unbekannte Produkte anschließend über Open Food Facts aufgelöst. Das Speichern in D1 erfolgt erst nach Bestätigung und wird der anonymen persönlichen Nutzerkennung zugeordnet.


## Mehrnutzer-Modus v0.8.3
Jede Installation erzeugt beim ersten erfolgreichen Backend-Kontakt automatisch eine anonyme, zufällige Nutzerkennung. Produktkatalog und Preise bleiben gemeinsam; Beobachtungsliste und Preiswecker werden pro Nutzer in D1 getrennt gespeichert. Der bisherige WRITE_TOKEN wird in der Nutzeroberfläche nicht mehr benötigt.


## Händlerauswahl
Ab v0.8.3 besitzt jeder anonyme Nutzer eine eigene Händlerauswahl. Deaktivierte Händler werden in Preisvergleich, günstigstem Preis, Preisweckern und kommenden Angeboten nicht berücksichtigt. Regionale Filialverfügbarkeit wird später zusätzlich über `stores` ergänzt.


## Scanner-first v0.8.3
Der Barcode-Scan ist die Hauptfunktion. Nach Erkennung einer EAN führt die PWA automatisch einen Multi-Source-Preisvergleich über den Worker aus. Quellen sind derzeit Open Prices, der offene German-Supermarket-Prices-Datensatz und ein direkter GLOBUS-Adapter. Fehlende Händlerdaten bedeuten ausdrücklich nicht, dass ein Produkt dort nicht geführt wird. Ältere Preisstände werden separat markiert.
