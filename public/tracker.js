/**
 * Calar Full Tracking Script
 * Tracks: Page views, SPA navigation, time on page, scroll depth, clicks, custom events
 *
 * Usage:
 * <script
 *   data-api-key="YOUR_API_KEY"
 *   data-endpoint="https://your-calar.com"
 *   src="https://your-calar.com/tracker.js">
 * </script>
 */
(function() {
  'use strict';

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  var config = {
    endpoint: null,
    apiKey: null,
    visitorId: null,
    debug: false,
    trackClicks: true,
    trackScroll: true,
    trackTime: true,
    clickSelectors: 'a, button, [data-track], input[type="submit"]'
  };

  var state = {
    currentUrl: null,
    pageStartTime: null,
    maxScrollDepth: 0,
    engagementSent: false,
    lastActivityTime: null
  };

  var STORAGE_KEY = 'hepta_visitor';
  var ATTRIBUTION_KEY = 'hepta_attribution';

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  function log() {
    if (config.debug) {
      console.log.apply(console, ['[Calar]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function getVisitorId() {
    var vid = null;
    try {
      vid = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}

    if (!vid) {
      vid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      try {
        localStorage.setItem(STORAGE_KEY, vid);
      } catch (e) {}
    }
    return vid;
  }

  function getUtmParams() {
    var params = {};
    try {
      var q = new URLSearchParams(window.location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function(key) {
        var val = q.get(key);
        if (val) params[key] = val;
      });
    } catch (e) {}
    return params;
  }

  function storeAttribution() {
    var utm = getUtmParams();
    if (Object.keys(utm).length > 0) {
      var attr = {
        utmSource: utm.utm_source,
        utmMedium: utm.utm_medium,
        utmCampaign: utm.utm_campaign,
        utmContent: utm.utm_content,
        utmTerm: utm.utm_term,
        referrer: document.referrer,
        landingPage: window.location.href,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attr));
      } catch (e) {}
    }
  }

  function getStoredAttribution() {
    try {
      var stored = localStorage.getItem(ATTRIBUTION_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  function send(path, data, useBeacon) {
    var url = config.endpoint + path;
    var payload = Object.assign({
      api_key: config.apiKey,
      visitor_id: config.visitorId
    }, data);

    log('Sending', path, payload);

    // Use sendBeacon for exit events (more reliable)
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, JSON.stringify(payload));
      return Promise.resolve();
    }

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function(err) {
      log('Error', err);
    });
  }

  // ==========================================================================
  // SCROLL TRACKING
  // ==========================================================================

  function getScrollDepth() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var scrollHeight = document.documentElement.scrollHeight;
    var clientHeight = document.documentElement.clientHeight;

    if (scrollHeight <= clientHeight) return 100;

    var maxScroll = scrollHeight - clientHeight;
    return Math.round((scrollTop / maxScroll) * 100);
  }

  function onScroll() {
    var depth = getScrollDepth();
    if (depth > state.maxScrollDepth) {
      state.maxScrollDepth = depth;
    }
    state.lastActivityTime = Date.now();
  }

  // ==========================================================================
  // TIME TRACKING
  // ==========================================================================

  function getTimeOnPage() {
    if (!state.pageStartTime) return 0;
    return Math.round((Date.now() - state.pageStartTime) / 1000);
  }

  function sendEngagement(isExit) {
    if (!config.trackTime && !config.trackScroll) return;

    var duration = getTimeOnPage();
    var scrollDepth = state.maxScrollDepth;

    // Don't send if no meaningful engagement
    if (duration < 1 && scrollDepth < 1) return;

    send('/api/v1/capture/engagement', {
      url: state.currentUrl,
      duration: duration,
      scroll_depth: scrollDepth,
      is_exit: isExit === true
    }, isExit);

    state.engagementSent = true;
  }

  // Send engagement periodically (every 30s)
  function startEngagementInterval() {
    setInterval(function() {
      if (getTimeOnPage() > 5) {
        sendEngagement(false);
      }
    }, 30000);
  }

  // ==========================================================================
  // PAGE VIEW TRACKING
  // ==========================================================================

  function trackPageView() {
    var utm = getUtmParams();
    storeAttribution();

    state.currentUrl = window.location.href;
    state.pageStartTime = Date.now();
    state.maxScrollDepth = getScrollDepth();
    state.engagementSent = false;
    state.lastActivityTime = Date.now();

    send('/api/v1/capture/visit', {
      url: window.location.href,
      referrer: document.referrer || '',
      utm_source: utm.utm_source || '',
      utm_medium: utm.utm_medium || '',
      utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '',
      utm_term: utm.utm_term || ''
    });

    log('Page view tracked', window.location.href);
  }

  // ==========================================================================
  // SPA NAVIGATION TRACKING
  // ==========================================================================

  function setupSpaTracking() {
    var lastUrl = window.location.href;

    function checkUrlChange() {
      if (window.location.href !== lastUrl) {
        // Send engagement for previous page
        sendEngagement(true);

        lastUrl = window.location.href;
        trackPageView();
      }
    }

    // Popstate (back/forward)
    window.addEventListener('popstate', checkUrlChange);

    // Override pushState
    var originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      setTimeout(checkUrlChange, 0);
    };

    // Override replaceState
    var originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      setTimeout(checkUrlChange, 0);
    };
  }

  // ==========================================================================
  // CLICK TRACKING
  // ==========================================================================

  function getElementIdentifier(el) {
    // Priority: data-track > id > text content > tag
    if (el.dataset && el.dataset.track) {
      return el.dataset.track;
    }
    if (el.id) {
      return '#' + el.id;
    }
    var text = (el.innerText || el.textContent || '').trim().slice(0, 50);
    if (text) {
      return el.tagName.toLowerCase() + ':' + text;
    }
    return el.tagName.toLowerCase();
  }

  function setupClickTracking() {
    if (!config.trackClicks) return;

    document.addEventListener('click', function(e) {
      var target = e.target;

      // Find the closest trackable element
      var trackable = target.closest(config.clickSelectors);
      if (!trackable) return;

      var name = getElementIdentifier(trackable);
      var properties = {
        tag: trackable.tagName.toLowerCase(),
        text: (trackable.innerText || '').trim().slice(0, 100)
      };

      // Add href for links
      if (trackable.href) {
        properties.href = trackable.href;
        properties.isExternal = trackable.hostname !== window.location.hostname;
      }

      // Add data attributes
      if (trackable.dataset) {
        Object.keys(trackable.dataset).forEach(function(key) {
          if (key !== 'track') {
            properties['data_' + key] = trackable.dataset[key];
          }
        });
      }

      send('/api/v1/capture/event', {
        type: 'click',
        name: name,
        properties: properties,
        url: window.location.href
      });

      log('Click tracked', name, properties);
    }, true);
  }

  // ==========================================================================
  // CUSTOM EVENT TRACKING
  // ==========================================================================

  function trackEvent(name, properties) {
    if (!name) {
      console.warn('[Calar] trackEvent requires a name');
      return;
    }

    send('/api/v1/capture/event', {
      type: 'custom',
      name: name,
      properties: properties || {},
      url: window.location.href
    });

    log('Custom event tracked', name, properties);
  }

  // ==========================================================================
  // LEAD CAPTURE
  // ==========================================================================

  function trackLead(data) {
    if (!data || !data.email) {
      console.warn('[Calar] trackLead requires email');
      return Promise.reject(new Error('Email required'));
    }

    var attr = getStoredAttribution();

    return send('/api/v1/capture', {
      visitorUuid: config.visitorId,
      email: data.email.toLowerCase().trim(),
      name: data.name || null,
      company: data.company || null,
      attribution: attr
    }).then(function() {
      log('Lead tracked', data.email);
    });
  }

  // Legacy support
  function heptaCapture(email, name, company) {
    return trackLead({ email: email, name: name, company: company });
  }

  // ==========================================================================
  // FORM TRACKING
  // ==========================================================================

  function setupFormTracking() {
    // Track form focus (form_start event)
    document.addEventListener('focusin', function(e) {
      var form = e.target.closest('form');
      if (!form || form.dataset.calarTracked) return;

      form.dataset.calarTracked = 'true';

      send('/api/v1/capture/event', {
        type: 'form_start',
        name: form.id || form.name || 'unnamed_form',
        properties: {
          action: form.action,
          fields: form.elements.length
        },
        url: window.location.href
      });
    }, true);

    // Track form submissions
    document.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      if (form.dataset.calarIgnore === 'true') return;

      // Find email field for auto lead capture
      var emailField = form.querySelector('input[type="email"], input[name="email"], input[name*="email"]');
      if (emailField && emailField.value) {
        var nameField = form.querySelector('input[name="name"], input[name*="name"]:not([name*="email"])');
        var companyField = form.querySelector('input[name="company"], input[name*="company"], input[name*="organization"]');

        trackLead({
          email: emailField.value,
          name: nameField ? nameField.value : null,
          company: companyField ? companyField.value : null
        });
      }

      send('/api/v1/capture/event', {
        type: 'form_submit',
        name: form.id || form.name || 'unnamed_form',
        properties: {
          action: form.action,
          hasEmail: !!emailField
        },
        url: window.location.href
      });
    }, true);
  }

  // ==========================================================================
  // EXIT TRACKING
  // ==========================================================================

  function setupExitTracking() {
    // Before unload - send final engagement
    window.addEventListener('beforeunload', function() {
      sendEngagement(true);
    });

    // Visibility change - user switched tabs
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        sendEngagement(true);
      }
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  function init() {
    // Find script tag
    var script = document.currentScript;
    if (!script) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].getAttribute('data-api-key')) {
          script = scripts[i];
          break;
        }
      }
    }

    if (!script) {
      console.warn('[Calar] No script tag found with data-api-key');
      return;
    }

    // Extract config
    config.apiKey = script.getAttribute('data-api-key');
    config.endpoint = script.getAttribute('data-endpoint') || script.src.replace(/\/tracker\.js.*$/, '');
    config.debug = script.getAttribute('data-debug') === 'true';
    config.trackClicks = script.getAttribute('data-track-clicks') !== 'false';
    config.trackScroll = script.getAttribute('data-track-scroll') !== 'false';
    config.trackTime = script.getAttribute('data-track-time') !== 'false';
    config.endpoint = config.endpoint.replace(/\/$/, '');
    config.visitorId = getVisitorId();

    if (!config.apiKey) {
      console.warn('[Calar] No API key provided');
      return;
    }

    log('Initialized', config);

    // Setup tracking
    if (config.trackScroll) {
      window.addEventListener('scroll', onScroll, { passive: true });
    }

    setupClickTracking();
    setupFormTracking();
    setupSpaTracking();
    setupExitTracking();
    startEngagementInterval();

    // Track initial page view
    trackPageView();

    // Expose global API
    window.Calar = {
      trackEvent: trackEvent,
      trackLead: trackLead,
      trackPageView: trackPageView,
      getVisitorId: function() { return config.visitorId; },
      debug: function(enabled) { config.debug = enabled; }
    };

    // Legacy support for heptaCapture
    window.heptaCapture = heptaCapture;
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
