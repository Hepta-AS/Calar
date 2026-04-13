(function () {
  var STORAGE_KEY = "calaros_visitor_id";
  var ENDPOINT = "https://calaros.no/api/v1/capture/visit";

  var vid = localStorage.getItem(STORAGE_KEY);
  if (!vid) {
    vid =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, vid);
  }

  var script = document.currentScript;
  if (!script)
    for (var scripts = document.scripts, j = scripts.length - 1; j >= 0; j--)
      if (scripts[j].getAttribute("data-api-key")) {
        script = scripts[j];
        break;
      }
  var apiKey = script && script.getAttribute("data-api-key");
  if (!apiKey) return;

  var q = new URLSearchParams(location.search);
  function utm(k) {
    return q.get(k) || "";
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      visitor_id: vid,
      url: location.href,
      referrer: document.referrer || "",
      utm_source: utm("utm_source"),
      utm_medium: utm("utm_medium"),
      utm_campaign: utm("utm_campaign"),
      utm_content: utm("utm_content"),
      utm_term: utm("utm_term"),
    }),
    mode: "cors",
    keepalive: true,
  }).catch(function () {});
})();
