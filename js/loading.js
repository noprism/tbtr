/* ------------------------------------------------------------------
   Garry's Mod Loading Screen - Hooks & UI
   ES5 only (laeuft auch in aelteren Awesomium-/CEF-Versionen von GMod).

   Von GMod aufgerufene Funktionen:
     GameDetails(servername, serverurl, mapname, maxplayers, steamid, gamemode)
     DownloadingFile(fileName)
     SetFilesTotal(total)
     SetFilesNeeded(needed)
     SetStatusChanged(status)      <- Anzeige "| CURRENT LOADING STATUS |" im Design
   ------------------------------------------------------------------ */
(function (window, document) {
  "use strict";

  var cfg = window.LoadingConfig || {};

  // Gesamter Zustand. Die Hooks koennen aufgerufen werden, bevor das DOM
  // fertig ist - deshalb erst speichern, dann rendern.
  var state = {
    servername: "",
    serverurl: "",
    mapname: "",
    maxplayers: 0,
    steamid: "",
    gamemode: "",
    filesTotal: 0,
    filesNeeded: 0,
    currentFile: "",
    status: ""
  };

  var el = {};
  var domReady = false;
  var designMode = /[?&]design\b/.test(window.location.search); // zeigt die Platzhalter aus dem Figma-Design

  function toInt(v) {
    var n = parseInt(v, 10);
    return isNaN(n) || n < 0 ? 0 : n;
  }

  function clean(s) {
    return String(s === null || s === undefined ? "" : s).replace(/['"]/g, "");
  }

  function percent() {
    if (state.filesTotal <= 0) { return 0; }
    var done = state.filesTotal - state.filesNeeded;
    var p = (done / state.filesTotal) * 100;
    return Math.max(0, Math.min(100, p));
  }

  function render() {
    if (!domReady || designMode) { return; }

    var p = percent();
    el.fill.style.width = p + "%";
    el.percent.textContent = Math.floor(p) + "%";

    el.status.textContent = state.status || cfg.idleStatus || "Connecting";

    var line = "";
    if (state.currentFile) {
      line = "Downloading: " + state.currentFile;
      if (state.filesTotal > 0) {
        var done = Math.max(0, state.filesTotal - state.filesNeeded);
        line += " - " + done + "/" + state.filesTotal + " Files";
      }
    } else if (state.filesTotal > 0 && state.filesNeeded === 0) {
      line = "Download complete - " + state.filesTotal + "/" + state.filesTotal + " Files";
    }
    el.download.textContent = line;
  }

  /* ----------------------- GMod-Hooks ----------------------- */

  window.GameDetails = function (servername, serverurl, mapname, maxplayers, steamid, gamemode) {
    state.servername = clean(servername);
    state.serverurl = clean(serverurl);
    state.mapname = clean(mapname);
    state.maxplayers = toInt(maxplayers);
    state.steamid = clean(steamid);
    state.gamemode = clean(gamemode);

    if (state.servername) { document.title = state.servername; }
    if (document.body) {
      var b = document.body;
      b.setAttribute("data-servername", state.servername);
      b.setAttribute("data-map", state.mapname);
      b.setAttribute("data-maxplayers", String(state.maxplayers));
      b.setAttribute("data-gamemode", state.gamemode);
      b.setAttribute("data-steamid", state.steamid);
    }
    if (typeof LoadingScreen.onGameDetails === "function") {
      LoadingScreen.onGameDetails(state);
    }
  };

  window.DownloadingFile = function (fileName) {
    state.currentFile = clean(fileName);
    render();
  };

  window.SetFilesTotal = function (total) {
    state.filesTotal = toInt(total);
    render();
  };

  window.SetFilesNeeded = function (needed) {
    state.filesNeeded = toInt(needed);
    // Alle Dateien da -> aktuellen Dateinamen zuruecksetzen
    if (state.filesTotal > 0 && state.filesNeeded === 0) { state.currentFile = ""; }
    render();
  };

  window.SetStatusChanged = function (status) {
    state.status = clean(status);
    render();
  };

  /* --------------------- Oeffentliche API ------------------- */
  var LoadingScreen = window.LoadingScreen = {
    state: state,
    render: render,
    onGameDetails: null     // optional: function (state) { ... }
  };

  /* ------------------------- Layout ------------------------- */

  // Das Design ist 1920x1080; 1rem = 10px. Alles skaliert mit dem Fenster.
  function fit() {
    var w = window.innerWidth || document.documentElement.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight;
    var s = Math.min(w / 1920, h / 1080);
    document.documentElement.style.fontSize = (s * 10) + "px";
  }

  function init() {
    domReady = true;
    el.fill = document.getElementById("fill");
    el.percent = document.getElementById("percent");
    el.status = document.getElementById("statusText");
    el.download = document.getElementById("downloadText");

    document.getElementById("syncText").textContent = cfg.syncText || "Synchronizing Data, please wait";

    if (cfg.logoImage) {
      var img = document.getElementById("logoImg");
      img.src = cfg.logoImage;
      img.style.display = "block";
      var mark = document.querySelector("#logo .mark");
      if (mark) { mark.style.display = "none"; }
    }

    if (designMode) {
      el.fill.style.width = "14%";   // exakt wie im Figma-Mockup
    }
    render();
    if (state.servername) { window.GameDetails(state.servername, state.serverurl, state.mapname, state.maxplayers, state.steamid, state.gamemode); }
  }

  fit();
  window.addEventListener("resize", fit, false);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, false);
  } else {
    init();
  }
})(window, document);
