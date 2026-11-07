/* ------------------------------------------------------------------
   Einstellungen - hier kannst du alles Wichtige anpassen.
   ------------------------------------------------------------------ */
window.LoadingConfig = {

  // Text neben dem Spinner (links unten)
  syncText: "Synchronizing Data, please wait",

  // Status, solange der Server noch keinen gemeldet hat
  idleStatus: "Connecting",

  // Optional: eigenes Logo statt dem nachgebauten SVG, z.B. "img/logo.png"
  // (wird im Kreis zugeschnitten; leer lassen = SVG-Logo)
  logoImage: "",

  // Musik-Visualizer rund um das Logo (reagiert auf die Hintergrundmusik)
  viz: {
    enabled: true,
    bars: 96,           // Anzahl Balken (gerade Zahl)
    maxLength: 46,      // maximale Balkenlaenge
    fps: 45,            // weniger = schonender
    crossOrigin: false  // true, wenn die Musik auf einer anderen Domain liegt (braucht CORS-Header!)
  },

  // Hintergrundmusik
  music: {
    enabled: true,
    volume: 0.35,        // 0.0 - 1.0
    fadeInSeconds: 3,    // sanftes Einblenden am Anfang
    shuffle: false,      // Reihenfolge mischen
    startRandom: false,  // mit zufaelligem Titel beginnen
    tracks: [
      // { src: "music/dein-song.mp3", title: "Song Name", artist: "Artist Name" },
      { src: "music/demo-ambient.mp3", title: "Ambient Demo", artist: "Placeholder" }
    ]
  }
};
