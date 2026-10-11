/* ------------------------------------------------------------------
   Hintergrundmusik + "Now Playing"-Anzeige
   Konfiguration in js/config.js (LoadingConfig.music)
   ------------------------------------------------------------------ */
(function (window, document) {
  "use strict";

  var cfg = (window.LoadingConfig && window.LoadingConfig.music) || {};
  var playerEl = document.getElementById("player");
  var audio = document.getElementById("bgm");

  var tracks = cfg.tracks || [];
  if (!cfg.enabled || !tracks.length || !audio) {
    if (playerEl) { playerEl.className += " off"; }
    return;
  }

  var elTitle = document.getElementById("npTitle");
  var elCur = document.getElementById("npCur");
  var elDur = document.getElementById("npDur");
  var elFill = document.getElementById("npFill");

  var targetVolume = typeof cfg.volume === "number" ? Math.max(0, Math.min(1, cfg.volume)) : 0.35;
  var fadeMs = (typeof cfg.fadeInSeconds === "number" ? cfg.fadeInSeconds : 3) * 1000;

  var order = [];
  var pos = 0;
  var failures = 0;
  var fadeTimer = null;
  var waitingForGesture = false;

  function buildOrder() {
    var i, j, t;
    order = [];
    for (i = 0; i < tracks.length; i++) { order.push(i); }
    if (cfg.shuffle) {
      for (i = order.length - 1; i > 0; i--) {   // Fisher-Yates
        j = Math.floor(Math.random() * (i + 1));
        t = order[i]; order[i] = order[j]; order[j] = t;
      }
    }
    pos = cfg.startRandom && !cfg.shuffle ? Math.floor(Math.random() * order.length) : 0;
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) { sec = 0; }
    sec = Math.floor(sec);
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function setTitle(t) {
    var text = t.title || "Unknown Title";
    if (t.artist) { text += " - " + t.artist; }
    elTitle.textContent = "Now Playing : " + text;
  }

  function fadeIn() {
    if (fadeTimer) { clearInterval(fadeTimer); }
    if (fadeMs <= 0) { audio.volume = targetVolume; return; }
    var start = new Date().getTime();
    audio.volume = 0;
    fadeTimer = setInterval(function () {
      var k = (new Date().getTime() - start) / fadeMs;
      if (k >= 1) { audio.volume = targetVolume; clearInterval(fadeTimer); fadeTimer = null; return; }
      audio.volume = targetVolume * k;
    }, 80);
  }

  function tryPlay() {
    var p;
    try { p = audio.play(); } catch (e) { p = null; }
    if (p && typeof p.then === "function") {
      p.then(function () { waitingForGesture = false; }, function () { waitForGesture(); });
    }
  }

  // Falls der Browser Autoplay blockiert: beim ersten Klick/Tastendruck starten.
  function waitForGesture() {
    if (waitingForGesture) { return; }
    waitingForGesture = true;
    var go = function () {
      document.removeEventListener("click", go, true);
      document.removeEventListener("keydown", go, true);
      document.removeEventListener("mousedown", go, true);
      waitingForGesture = false;
      tryPlay();
    };
    document.addEventListener("click", go, true);
    document.addEventListener("keydown", go, true);
    document.addEventListener("mousedown", go, true);
  }

  var first = true;
  function load(p) {
    var t = tracks[order[p]];
    setTitle(t);
    elCur.textContent = "00:00";
    elDur.textContent = "00:00";
    elFill.style.width = "0%";
    audio.src = t.src;
    if (first) { audio.volume = 0; first = false; fadeIn(); } else { audio.volume = targetVolume; }
    try { audio.load(); } catch (e) {}
    tryPlay();
  }

  function next() {
    pos = (pos + 1) % order.length;
    load(pos);
  }

  audio.addEventListener("loadedmetadata", function () {
    failures = 0;
    elDur.textContent = fmt(audio.duration);
  }, false);

  audio.addEventListener("timeupdate", function () {
    elCur.textContent = fmt(audio.currentTime);
    if (audio.duration && isFinite(audio.duration)) {
      elFill.style.width = Math.min(100, (audio.currentTime / audio.duration) * 100) + "%";
    }
  }, false);

  audio.addEventListener("ended", function () {
    if (order.length === 1) {            // einzelner Titel -> Loop
      audio.currentTime = 0;
      tryPlay();
    } else {
      next();
    }
  }, false);

  // Datei fehlt / nicht abspielbar -> naechsten Titel probieren; wenn alle kaputt: Player ausblenden
  audio.addEventListener("error", function () {
    failures++;
    if (failures >= order.length) {
      playerEl.className += " off";
      return;
    }
    next();
  }, false);

  buildOrder();
  load(pos);
})(window, document);
