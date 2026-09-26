# preisscan

Private PWA „Einkaufshilfe“ für Preisvergleich, Produktsuche, Preiswecker und kommende Angebote.

## Stand v0.5.0

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


## Backend v0.5.0

API: `https://preisscan-api.ralf-music.workers.dev`

Der öffentliche Frontend-Code enthält keinen WRITE_TOKEN. Der Token wird in der PWA unter **Einstellungen** einmal lokal im Browser gespeichert und nur bei geschützten POST/PUT/DELETE-Anfragen als `X-Preisscan-Token` gesendet.

Solange `price_observations` in D1 noch leer ist, nutzt die Oberfläche für bereits bekannte Preise den verifizierten lokalen Datenstand aus v0.3.1.


## PWA-Icons
Die installierbare PWA enthält lokale 192×192-, 512×512-, Maskable-, Apple-Touch- und Favicon-Dateien.


## Barcode-Scanner v0.5.0
Die PWA scannt EAN-8/EAN-13/UPC über die Kamera. Unterstützte Browser verwenden die native BarcodeDetector-API; ansonsten wird html5-qrcode 2.3.8 als Fallback geladen. Bekannte Barcodes werden in der eigenen API gesucht, unbekannte Produkte anschließend über Open Food Facts aufgelöst. Das Speichern in D1 erfolgt erst nach Bestätigung und benötigt den lokal gespeicherten WRITE_TOKEN.
