/* ------------------------------------------------------------------
   Musik-Visualizer rund um das TBTR-Logo
   Kreisfoermiger Equalizer: Balken wachsen aus dem Ring nach aussen und
   reagieren auf die Hintergrundmusik (Web Audio AnalyserNode).
   Tiefe Toene oben, hohe unten, links/rechts gespiegelt.

   Einstellungen: js/config.js -> viz
   Hinweis: Liegt die Musik auf einer ANDEREN Domain als die Seite, braucht
   der Browser CORS-Header und viz.crossOrigin = true - sonst bleibt der
   Visualizer ruhig (die Musik selbst wird dadurch nie beeintraechtigt).
   ------------------------------------------------------------------ */
(function (window, document) {
  "use strict";

  var cfg = (window.LoadingConfig && window.LoadingConfig.viz) || {};
  if (cfg.enabled === false) { return; }

  var canvas = document.getElementById("viz");
  var audio = document.getElementById("bgm");
  if (!canvas || !audio) { return; }

  var BARS = Math.max(16, (cfg.bars || 96) & ~1);       // gerade Anzahl (Spiegelung)
  var HALF = BARS / 2;
  var MAX_LEN = cfg.maxLength || 46;                    // Logo-Einheiten (Logo = 400)
  var GAP = 6;                                          // Abstand zum Ring
  var R0 = 200 + GAP;
  var SIZE = 512;                                       // Canvas = 512 Einheiten, Logo-Mitte in der Mitte
  var MIN_LEN = 3;
  var BAR_W = (2 * Math.PI * R0 / BARS) * 0.46;
  var minDelta = 1000 / (cfg.fps || 45);

  var ctx2d = canvas.getContext && canvas.getContext("2d");
  if (!ctx2d) { return; }

  /* ------------------------- Farben (wie der Ring) ------------------------- */
  var PALETTE = [[246, 231, 166], [169, 154, 242], [126, 102, 236], [201, 91, 217], [169, 154, 242]];   // Creme > Lavendel > Violett > Pink > zurueck
  function colorAt(t) {                                  // t 0..1 zyklisch
    t = t - Math.floor(t);
    var n = PALETTE.length - 1, x = t * n, i = Math.floor(x), k = x - i;
    var a = PALETTE[i], b = PALETTE[Math.min(n, i + 1)];
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
  }

  /* ------------------------------ Audio ------------------------------ */
  var AC = window.AudioContext || window.webkitAudioContext;
  var actx = null, analyser = null, data = null, connected = false, failed = false;
  var peak = 40;

  function sameOrigin(url) {
    if (window.location.protocol === "file:") { return false; }   // file:// -> Browser schaltet Web Audio stumm
    if (cfg.crossOrigin) { return true; }
    var a = document.createElement("a");
    a.href = url;
    return (!a.host || a.host === window.location.host) && (!a.protocol || a.protocol === window.location.protocol || a.protocol === ":");
  }

  // Erst verbinden, wenn der AudioContext wirklich laeuft - sonst wuerde das <audio>-Element stumm.
  function ensureAudio() {
    if (connected || failed || !AC) { return; }
    var src = audio.currentSrc || audio.src;
    if (!src || !sameOrigin(src)) { return; }
    try {
      if (!actx) { actx = new AC(); }
      if (actx.state !== "running") {
        if (actx.resume) { actx.resume(); }
        if (actx.state !== "running") { return; }        // spaeter nochmal (Klick / play-Event)
      }
      analyser = actx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      var node = actx.createMediaElementSource(audio);
      node.connect(analyser);
      analyser.connect(actx.destination);
      data = new Uint8Array(analyser.frequencyBinCount);
      connected = true;
    } catch (e) {
      failed = true;
      if (window.console && console.warn) { console.warn("[visualizer] Web Audio nicht verfuegbar:", e && e.message); }
    }
  }

  audio.addEventListener("playing", ensureAudio, false);
  audio.addEventListener("play", ensureAudio, false);
  var gestures = ["click", "mousedown", "keydown", "touchstart"];
  for (var g = 0; g < gestures.length; g++) { document.addEventListener(gestures[g], ensureAudio, true); }

  /* ----------------------------- Layout ----------------------------- */
  function layout() {
    var rem = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 10;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var px = Math.max(256, Math.min(1024, Math.round(SIZE * (rem / 10) * dpr)));
    if (canvas.width !== px) { canvas.width = canvas.height = px; }
  }
  layout();
  window.addEventListener("resize", layout, false);

  /* ----------------------------- Zeichnen ----------------------------- */
  var level = [], i0;
  for (i0 = 0; i0 < HALF; i0++) { level.push(0); }

  function bandValue(j) {                               // j = 0..HALF-1, logarithmisch ueber 40 Hz .. 12 kHz
    var binHz = actx.sampleRate / analyser.fftSize;
    var lo = Math.max(1, 40 / binHz), hi = Math.min(data.length - 2, 12000 / binHz);
    var pos = lo * Math.pow(hi / lo, j / (HALF - 1));
    var i = Math.floor(pos), k = pos - i;
    return data[i] * (1 - k) + data[i + 1] * k;
  }

  var last = 0;
  function frame(now) {
    window.requestAnimationFrame(frame);
    if (document.hidden || now - last < minDelta) { return; }
    last = now;

    var j, v, vals = [];
    if (connected && !audio.paused) {
      analyser.getByteFrequencyData(data);
      var mx = 0;
      for (j = 0; j < HALF; j++) { v = bandValue(j); vals.push(v); if (v > mx) { mx = v; } }
      peak = Math.max(40, peak * 0.995, mx);            // automatische Lautstaerke-Anpassung
    }
    for (j = 0; j < HALF; j++) {
      v = vals.length ? Math.pow(Math.min(1, vals[j] / peak), 1.4) : 0;
      level[j] = v > level[j] ? level[j] + (v - level[j]) * 0.65 : level[j] * 0.9;   // schneller Anstieg, weiches Abklingen
    }

    var s = canvas.width / SIZE, c = SIZE / 2 * s;
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.lineCap = "round";
    var drift = now / 40000, step = (Math.PI * 2) / BARS, i, a, cos, sin, len, r1, r2;
    for (i = 0; i < BARS; i++) {
      j = i < HALF ? i : BARS - 1 - i;                  // Spiegelung um die senkrechte Achse
      len = MIN_LEN + level[j] * MAX_LEN;
      a = -Math.PI / 2 + (i + 0.5) * step;              // Start oben, im Uhrzeigersinn
      cos = Math.cos(a); sin = Math.sin(a);
      r1 = R0 * s; r2 = (R0 + len) * s;
      ctx2d.strokeStyle = colorAt(i / BARS + drift);
      ctx2d.globalAlpha = 0.18;                         // weicher Schein
      ctx2d.lineWidth = BAR_W * 2.2 * s;
      ctx2d.beginPath(); ctx2d.moveTo(c + cos * r1, c + sin * r1); ctx2d.lineTo(c + cos * r2, c + sin * r2); ctx2d.stroke();
      ctx2d.globalAlpha = 0.95;
      ctx2d.lineWidth = BAR_W * s;
      ctx2d.beginPath(); ctx2d.moveTo(c + cos * r1, c + sin * r1); ctx2d.lineTo(c + cos * r2, c + sin * r2); ctx2d.stroke();
    }
    ctx2d.globalAlpha = 1;
  }
  window.requestAnimationFrame(frame);
})(window, document);
