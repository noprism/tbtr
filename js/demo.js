/* ------------------------------------------------------------------
   Vorschau-Modus: index.html?demo
   Simuliert die Aufrufe, die Garry's Mod normalerweise macht - damit du
   die Seite im normalen Browser testen kannst. Ohne "?demo" passiert nichts.
   ------------------------------------------------------------------ */
(function (window) {
  "use strict";
  if (!/[?&]demo\b/.test(window.location.search)) { return; }

  var files = [
    "maps/gm_construct.bsp", "materials/tbtr/logo.vmt", "models/props/tbtr_crate.mdl",
    "sound/tbtr/ambience_01.wav", "lua/autorun/tbtr_init.lua", "materials/tbtr/floor.vtf",
    "models/player/tbtr_soldier.mdl", "resource/fonts/tbtr_sans.ttf"
  ];
  var statuses = ["Sending client info...", "Retrieving server info...", "Mounting content...", "Downloading files...", "Workshop Complete", "Starting Lua..."];

  window.GameDetails("TBTR Community Server", "https://example.com", "gm_construct", 32, "76561198000000000", "sandbox");
  window.SetFilesTotal(files.length * 5);
  window.SetFilesNeeded(files.length * 5);
  window.SetStatusChanged(statuses[0]);

  var n = 0, total = files.length * 5;
  var timer = setInterval(function () {
    n++;
    window.DownloadingFile(files[n % files.length]);
    window.SetFilesNeeded(total - n);
    window.SetStatusChanged(statuses[Math.min(statuses.length - 1, Math.floor(n / total * statuses.length))]);
    if (n >= total) { clearInterval(timer); window.SetStatusChanged("Starting Lua..."); }
  }, 450);
})(window);
