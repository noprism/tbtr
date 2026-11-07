/* ------------------------------------------------------------------
   Hintergrundmusik + "Now Playing"-Anzeige
   Konfiguration in js/config.js (LoadingConfig.music)

   Titel werden automatisch aus dem Ordner music/ gefunden:
     1. music/playlist.json  (erzeugt von music/make-playlist.py - noetig bei Hostern ohne Ordner-Anzeige, z.B. GitHub Pages)
     2. Ordner-Anzeige des Webservers (nginx/Apache autoindex)
     3. GitHub-API (nur bei *.github.io, als Notnagel)
   Titel/Interpret kommen aus den Metadaten der Datei (ID3, Vorbis/FLAC),
   sonst aus dem Dateinamen ("Interpret - Titel.mp3").
   ------------------------------------------------------------------ */
(function (window, document) {
  "use strict";

  var cfg = (window.LoadingConfig && window.LoadingConfig.music) || {};
  var playerEl = document.getElementById("player");
  var audio = document.getElementById("bgm");

  if (!cfg.enabled || !audio) {
    if (playerEl) { playerEl.className += " off"; }
    return;
  }

  var elTitle = document.getElementById("npTitle");
  var elCur = document.getElementById("npCur");
  var elDur = document.getElementById("npDur");
  var elFill = document.getElementById("npFill");

  var folder = typeof cfg.folder === "string" ? cfg.folder : "music/";
  if (folder && folder.charAt(folder.length - 1) !== "/") { folder += "/"; }
  var exts = cfg.extensions || ["mp3", "ogg", "oga", "opus", "wav", "flac", "m4a", "aac"];
  var extRe = new RegExp("\\.(" + exts.join("|") + ")$", "i");

  var targetVolume = typeof cfg.volume === "number" ? Math.max(0, Math.min(1, cfg.volume)) : 0.35;
  var fadeMs = (typeof cfg.fadeInSeconds === "number" ? cfg.fadeInSeconds : 3) * 1000;

  var tracks = [];
  var order = [];
  var pos = 0;
  var failures = 0;
  var fadeTimer = null;
  var waitingForGesture = false;
  var metaCache = {};

  /* ------------------------- kleine Helfer ------------------------- */
  function xhr(url, opts, cb) {
    var done = false, req;
    function finish(v) { if (!done) { done = true; cb(v); } }
    try {
      req = new XMLHttpRequest();
      req.open("GET", url, true);
      if (opts.range) { req.setRequestHeader("Range", opts.range); }
      if (opts.binary) { req.responseType = "arraybuffer"; }
      req.onreadystatechange = function () {
        if (req.readyState !== 4) { return; }
        if (req.status === 200 || req.status === 206) {
          finish({ status: req.status, data: opts.binary ? req.response : req.responseText, type: req.getResponseHeader("Content-Type") || "" });
        } else { finish(null); }
      };
      req.onerror = function () { finish(null); };
      req.send();
    } catch (e) { finish(null); }
  }

  function baseName(src) {
    var s = String(src).split("?")[0].split("#")[0];
    s = s.substring(s.lastIndexOf("/") + 1);
    try { s = decodeURIComponent(s); } catch (e) {}
    return s;
  }

  function titleFromName(src) {
    var n = baseName(src).replace(/\.[^.]+$/, "").replace(/_/g, " ").replace(/^\s*\d+\s*[-.)]\s+/, "");
    var m = n.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) { return { artist: m[1], title: m[2] }; }
    return { title: n, artist: "" };
  }

  /* --------------------------- Entdecken --------------------------- */
  function addFiles(list) {
    var i, src, seen = {};
    for (i = 0; i < tracks.length; i++) { seen[tracks[i].src] = true; }
    for (i = 0; i < list.length; i++) {
      var item = list[i];
      if (typeof item === "string") { item = { src: item }; }
      if (!item || !item.src) { continue; }
      src = item.src;
      if (!/^([a-z]+:)?\/\//i.test(src) && src.charAt(0) !== "/" && src.indexOf(folder) !== 0) { src = folder + src; }
      if (seen[src]) { continue; }
      seen[src] = true;
      tracks.push({ src: src, title: item.title || "", artist: item.artist || "" });
    }
  }

  function fromPlaylist(cb) {
    xhr(folder + "playlist.json", {}, function (r) {
      var j;
      if (!r) { return cb(false); }
      try { j = JSON.parse(r.data); } catch (e) { return cb(false); }
      if (j && !j.length && j.tracks) { j = j.tracks; }
      if (!j || !j.length) { return cb(false); }
      addFiles(j);
      cb(true);
    });
  }

  function fromDirectoryListing(cb) {
    xhr(folder, {}, function (r) {
      if (!r || !/html/i.test(r.type)) { return cb(false); }
      var re = /href\s*=\s*["']([^"'?#]+)["']/gi, m, files = [];
      while ((m = re.exec(r.data))) {
        if (extRe.test(m[1])) { files.push(m[1].replace(/^(\.\/)+/, "")); }
      }
      if (!files.length) { return cb(false); }
      // Ordner-Anzeige liefert Namen relativ zum Ordner (oder absolut ab "/")
      for (var i = 0; i < files.length; i++) {
        if (files[i].charAt(0) !== "/" && !/^[a-z]+:/i.test(files[i])) { files[i] = folder + files[i]; }
      }
      addFiles(files);
      cb(true);
    });
  }

  function fromGithub(cb) {
    var host = window.location.hostname, m = host.match(/^([^.]+)\.github\.io$/i);
    if (!m) { return cb(false); }
    var seg = window.location.pathname.split("/")[1];
    var repo = seg && seg.indexOf(".") < 0 ? seg : host;
    var dir = folder.replace(/\/$/, "");
    xhr("https://api.github.com/repos/" + m[1] + "/" + repo + "/contents/" + dir, {}, function (r) {
      var j, files = [], i;
      if (!r) { return cb(false); }
      try { j = JSON.parse(r.data); } catch (e) { return cb(false); }
      for (i = 0; j && i < j.length; i++) {
        if (j[i].type === "file" && extRe.test(j[i].name)) { files.push(folder + encodeURIComponent(j[i].name)); }
      }
      if (!files.length) { return cb(false); }
      addFiles(files);
      cb(true);
    });
  }

  function discover(cb) {
    if (cfg.tracks && cfg.tracks.length) { addFiles(cfg.tracks); }       // manuelle Liste (optional)
    if (cfg.autoScan === false) { return cb(); }
    fromPlaylist(function (ok) {
      if (ok) { return cb(); }
      fromDirectoryListing(function (ok2) {
        if (ok2) { return cb(); }
        fromGithub(function () { cb(); });
      });
    });
  }

  /* ------------------------ Metadaten lesen ------------------------ */
  function decodeText(u8, start, end, enc) {
    var s = "", i, c, c2;
    if (end <= start) { return ""; }
    if (enc === 0) {                                                     // ISO-8859-1
      for (i = start; i < end; i++) { s += String.fromCharCode(u8[i]); }
    } else if (enc === 3) {                                              // UTF-8
      for (i = start; i < end; i++) { s += String.fromCharCode(u8[i]); }
      try { s = decodeURIComponent(escape(s)); } catch (e) {}
    } else {                                                             // UTF-16 (mit/ohne BOM)
      var le = enc === 1 ? true : false;
      if (enc === 1 && end - start >= 2) {
        if (u8[start] === 0xFE && u8[start + 1] === 0xFF) { le = false; start += 2; }
        else if (u8[start] === 0xFF && u8[start + 1] === 0xFE) { le = true; start += 2; }
      }
      for (i = start; i + 1 < end; i += 2) {
        c = le ? u8[i] | (u8[i + 1] << 8) : (u8[i] << 8) | u8[i + 1];
        s += String.fromCharCode(c);
      }
    }
    c2 = s.indexOf("\u0000");
    if (c2 >= 0) { s = s.substring(0, c2); }
    return s.replace(/^\s+|\s+$/g, "");
  }

  function syncsafe(u8, i) { return ((u8[i] & 127) << 21) | ((u8[i + 1] & 127) << 14) | ((u8[i + 2] & 127) << 7) | (u8[i + 3] & 127); }
  function be32(u8, i) { return ((u8[i] << 24) | (u8[i + 1] << 16) | (u8[i + 2] << 8) | u8[i + 3]) >>> 0; }

  function parseId3v2(u8) {
    if (u8.length < 10 || u8[0] !== 0x49 || u8[1] !== 0x44 || u8[2] !== 0x33) { return null; }  // "ID3"
    var ver = u8[3], flags = u8[5], tagEnd = Math.min(u8.length, 10 + syncsafe(u8, 6));
    var p = 10, out = {}, idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
    if ((flags & 0x40) && ver >= 3) { p += ver === 4 ? syncsafe(u8, p) : be32(u8, p) + 4; }
    while (p + hdr <= tagEnd) {
      var id = "", i, size;
      for (i = 0; i < idLen; i++) { id += String.fromCharCode(u8[p + i]); }
      if (!/^[A-Z0-9]+$/.test(id)) { break; }                            // Padding erreicht
      if (ver === 2) { size = (u8[p + 3] << 16) | (u8[p + 4] << 8) | u8[p + 5]; }
      else { size = ver === 4 ? syncsafe(u8, p + 4) : be32(u8, p + 4); }
      var s = p + hdr, e = s + size;
      if (e > u8.length) { break; }                                      // abgeschnitten (z.B. Cover)
      if (size > 1) {
        var enc = u8[s], txt = decodeText(u8, s + 1, e, enc);
        if (id === "TIT2" || id === "TT2") { out.title = txt; }
        else if (id === "TPE1" || id === "TP1") { out.artist = txt; }
        else if ((id === "TPE2" || id === "TP2") && !out.albumArtist) { out.albumArtist = txt; }
      }
      p = e;
    }
    if (!out.artist && out.albumArtist) { out.artist = out.albumArtist; }
    return out.title || out.artist ? out : null;
  }

  function parseVorbis(u8) {                                             // Ogg/Opus/FLAC
    var n = Math.min(u8.length, 131072), s = "", i;
    for (i = 0; i < n; i++) { s += String.fromCharCode(u8[i]); }
    if (s.indexOf("OggS") !== 0 && s.indexOf("fLaC") !== 0) { return null; }
    var up = s.toUpperCase(), out = {};
    function field(name) {
      var k = up.indexOf(name + "=");
      if (k < 4) { return ""; }
      var len = u8[k - 4] | (u8[k - 3] << 8) | (u8[k - 2] << 16) | (u8[k - 1] << 24);
      if (len <= name.length + 1 || len > 2000 || k + len > u8.length) { return ""; }
      return decodeText(u8, k + name.length + 1, k + len, 3);
    }
    out.title = field("TITLE");
    out.artist = field("ARTIST");
    return out.title || out.artist ? out : null;
  }

  function parseId3v1(u8) {
    if (u8.length < 128) { return null; }
    var b = u8.length - 128;
    if (u8[b] !== 0x54 || u8[b + 1] !== 0x41 || u8[b + 2] !== 0x47) { return null; }   // "TAG"
    var t = decodeText(u8, b + 3, b + 33, 0), a = decodeText(u8, b + 33, b + 63, 0);
    return t || a ? { title: t, artist: a } : null;
  }

  function readMeta(src, cb) {
    if (metaCache[src]) { return cb(metaCache[src]); }
    function done(m) { metaCache[src] = m || {}; cb(metaCache[src]); }
    xhr(src, { binary: true, range: "bytes=0-262143" }, function (r) {
      if (!r || !r.data) { return done(null); }
      var u8 = new Uint8Array(r.data), m = parseId3v2(u8) || parseVorbis(u8);
      if (m) { return done(m); }
      if (r.status !== 206 && u8.length > 128) { return done(parseId3v1(u8)); }
      xhr(src, { binary: true, range: "bytes=-128" }, function (r2) {   // ID3v1 am Dateiende
        done(r2 && r2.data && r2.status === 206 ? parseId3v1(new Uint8Array(r2.data)) : null);
      });
    });
  }

  /* ------------------------------ Player ------------------------------ */
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

  function showTitle(title, artist) {
    var text = title || "Unknown Title";
    if (artist) { text += " - " + artist; }
    elTitle.textContent = "Now Playing : " + text;
  }

  function setTitle(t) {
    var guess = titleFromName(t.src);
    showTitle(t.title || guess.title, t.artist || guess.artist);       // sofort aus Dateiname/Config ...
    if (t.title && t.artist) { return; }
    var current = t.src;
    readMeta(t.src, function (m) {                                       // ... dann aus den Datei-Metadaten
      if (tracks[order[pos]].src !== current) { return; }
      showTitle(t.title || m.title || guess.title, t.artist || m.artist || guess.artist);
    });
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
    if (!order.length || failures >= order.length) {
      playerEl.className += " off";
      return;
    }
    next();
  }, false);

  if (window.LoadingConfig && window.LoadingConfig.viz && window.LoadingConfig.viz.crossOrigin) { audio.crossOrigin = "anonymous"; }

  discover(function () {
    if (!tracks.length) { if (playerEl) { playerEl.className += " off"; } return; }
    buildOrder();
    load(pos);
  });
})(window, document);
