/**
 * Calar Tracking Script
 *
 * Usage:
 * <script
 *   data-api-key="YOUR_API_KEY"
 *   data-endpoint="https://your-calar-instance.com"
 *   src="https://your-calar-instance.com/snippet.js">
 * </script>
 *
 * Or programmatically:
 * Calar.trackLead({ email: "user@example.com", name: "John" });
 */
(function () {
  "use strict";

  var STORAGE_KEY = "calar_visitor_id";
  var config = {
    endpoint: null,
    apiKey: null,
    visitorId: null,
    debug: false
  };

  // Get or create visitor ID
  function getVisitorId() {
    var vid = null;
    try {
      vid = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    if (!vid) {
      vid = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        localStorage.setItem(STORAGE_KEY, vid);
      } catch (e) {}
    }
    return vid;
  }

  // Find script tag and extract config
  function initConfig() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].getAttribute("data-api-key")) {
          script = scripts[i];
          break;
        }
      }
    }

    if (!script) {
      console.warn("[Calar] No script tag with data-api-key found");
      return false;
    }

    config.apiKey = script.getAttribute("data-api-key");
    config.endpoint = script.getAttribute("data-endpoint") || script.src.replace(/\/snippet\.js.*$/, "");
    config.debug = script.getAttribute("data-debug") === "true";
    config.visitorId = getVisitorId();

    // Remove trailing slash
    config.endpoint = config.endpoint.replace(/\/$/, "");

    if (!config.apiKey) {
      console.warn("[Calar] No API key provided");
      return false;
    }

    if (config.debug) {
      console.log("[Calar] Initialized", config);
    }

    return true;
  }

  // Get UTM parameters from URL
  function getUtmParams() {
    var params = {};
    try {
      var q = new URLSearchParams(window.location.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function(key) {
        var val = q.get(key);
        if (val) params[key] = val;
      });
    } catch (e) {}
    return params;
  }

  // Store UTM params for later lead capture
  function storeUtmParams() {
    var params = getUtmParams();
    if (Object.keys(params).length > 0) {
      try {
        sessionStorage.setItem("calar_utm", JSON.stringify(params));
      } catch (e) {}
    }
  }

  // Get stored UTM params
  function getStoredUtmParams() {
    try {
      var stored = sessionStorage.getItem("calar_utm");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  // Send data to Calar API
  function sendRequest(path, data) {
    var url = config.endpoint + path;
    var payload = Object.assign({
      api_key: config.apiKey,
      visitor_id: config.visitorId
    }, data);

    if (config.debug) {
      console.log("[Calar] Sending to", url, payload);
    }

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
      keepalive: true
    }).then(function(res) {
      if (config.debug) {
        console.log("[Calar] Response", res.status);
      }
      return res;
    }).catch(function(err) {
      if (config.debug) {
        console.error("[Calar] Error", err);
      }
    });
  }

  // Track page visit
  function trackVisit() {
    var utmParams = getUtmParams();
    storeUtmParams();

    sendRequest("/api/v1/capture/visit", {
      url: window.location.href,
      referrer: document.referrer || "",
      utm_source: utmParams.utm_source || "",
      utm_medium: utmParams.utm_medium || "",
      utm_campaign: utmParams.utm_campaign || "",
      utm_content: utmParams.utm_content || "",
      utm_term: utmParams.utm_term || ""
    });
  }

  // Track lead (form submission)
  function trackLead(data) {
    if (!data || !data.email) {
      console.warn("[Calar] trackLead requires email");
      return Promise.reject(new Error("Email required"));
    }

    var utmParams = getStoredUtmParams();

    return sendRequest("/api/v1/capture/lead", {
      email: data.email.toLowerCase().trim(),
      name: data.name || null,
      company: data.company || null,
      utm_source: utmParams.utm_source || "",
      utm_medium: utmParams.utm_medium || "",
      utm_campaign: utmParams.utm_campaign || "",
      utm_content: utmParams.utm_content || "",
      utm_term: utmParams.utm_term || ""
    });
  }

  // Auto-capture forms
  function setupFormCapture() {
    document.addEventListener("submit", function(e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;

      // Skip forms with data-calar-ignore
      if (form.getAttribute("data-calar-ignore") === "true") return;

      // Find email field
      var emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"]');
      if (!emailField || !emailField.value) return;

      // Find other fields
      var nameField = form.querySelector('input[name="name"], input[name*="name"]:not([name*="email"])');
      var companyField = form.querySelector('input[name="company"], input[name*="company"], input[name*="organization"]');

      var leadData = {
        email: emailField.value
      };

      if (nameField && nameField.value) {
        leadData.name = nameField.value;
      }

      if (companyField && companyField.value) {
        leadData.company = companyField.value;
      }

      if (config.debug) {
        console.log("[Calar] Form captured", leadData);
      }

      trackLead(leadData);
    }, true);
  }

  // Track SPA navigation
  function setupSpaTracking() {
    var lastUrl = window.location.href;

    function checkUrlChange() {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        trackVisit();
      }
    }

    // Listen for popstate (back/forward)
    window.addEventListener("popstate", checkUrlChange);

    // Override pushState and replaceState
    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;

    history.pushState = function() {
      originalPushState.apply(this, arguments);
      checkUrlChange();
    };

    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      checkUrlChange();
    };
  }

  // Initialize
  if (!initConfig()) return;

  // Expose global API
  window.Calar = {
    trackVisit: trackVisit,
    trackLead: trackLead,
    getVisitorId: function() { return config.visitorId; },
    debug: function(enabled) { config.debug = enabled; }
  };

  // Auto-track on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      trackVisit();
      setupFormCapture();
      setupSpaTracking();
    });
  } else {
    trackVisit();
    setupFormCapture();
    setupSpaTracking();
  }
})();
