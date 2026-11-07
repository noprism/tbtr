# TBTR – Garry's Mod Loading Screen

## Einbinden
1. Ordner auf einen Webspace laden (HTTPS empfohlen).
2. In der `server.cfg`:
   `sv_loadingurl "https://deine-domain.de/loading/index.html"`

## Vorschau im Browser
- `index.html?demo`   – simuliert alle GMod-Hooks (Download, Status, Musik)
- `index.html?design` – zeigt die Platzhalter aus dem Figma-Mockup (14 % Balken)

## Hooks (js/loading.js)
| Hook | Verwendung |
|---|---|
| `GameDetails(servername, serverurl, mapname, maxplayers, steamid, gamemode)` | Werte werden in `LoadingScreen.state` und als `data-*` am `<body>` gespeichert, Servername wird zum Seitentitel. Eigene Logik: `LoadingScreen.onGameDetails = function (state) {...}` |
| `SetFilesTotal(total)` / `SetFilesNeeded(needed)` | Fortschritt = (total − needed) / total → Balken + Prozentanzeige |
| `DownloadingFile(fileName)` | Zeile „Downloading: Datei – x/y Files“ |
| `SetStatusChanged(status)` | Text zwischen den Strichen „\| STATUS \|“ |

## Musik (js/music.js, Einstellungen in js/config.js)
Einfach alle Audiodateien (mp3, ogg, flac, wav, m4a …) in den Ordner `music/` legen. Titel und Interpret werden
aus den Metadaten der Datei gelesen (ID3, Vorbis/FLAC); fehlen sie, dient der Dateiname (`Interpret - Titel.mp3`).
Gefunden werden die Dateien in dieser Reihenfolge:
1. `music/playlist.json` – mit `python music/make-playlist.py` erzeugen (nötig bei GitHub Pages & Co. ohne Ordner-Anzeige)
2. Ordner-Anzeige des Webservers (nginx/Apache `autoindex`)
3. GitHub-API (nur `*.github.io`, Notnagel)
Optionen: `volume`, `fadeInSeconds`, `shuffle`, `startRandom`, `enabled`, `folder`, `autoScan`; optional `tracks` für Handeinträge.
`music/demo-ambient.mp3` ist nur ein generierter Platzhalter – bitte löschen.

## Logo
Statisches SVG-Logo (keine Animation): Ellipse 400×400 mit Farbverlauf-Ring und der Schriftzug „TBTR“
aus der Schrift „Libre Barcode 128 Text“ (SIL OFL, Lizenz in `fonts/LibreBarcode-OFL.txt`), als Pfad eingebettet.
Eigenes Logo statt allem: `logoImage: "img/logo.png"` in `js/config.js`.

## Musik-Visualizer (js/visualizer.js)
Der Ring ums Logo ist ein kreisförmiger Equalizer: Balken im Ring-Farbverlauf wachsen nach außen und
reagieren auf die Musik (tiefe Töne oben, hohe unten, links/rechts gespiegelt). Einstellungen in `js/config.js` → `viz`.
Liegt die Musik auf einer anderen Domain als die Seite, braucht sie CORS-Header und `crossOrigin: true`;
sonst (und beim Öffnen per `file://`) bleibt der Visualizer ruhig – die Musik läuft trotzdem.
