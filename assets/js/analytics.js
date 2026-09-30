/* Deferred GA4 bootstrap; never track local previews or browser privacy opt-outs. */
(function () {
  "use strict";

  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    navigator.globalPrivacyControl ||
    navigator.doNotTrack === "1" ||
    window.doNotTrack === "1"
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
  window.gtag("js", new Date());
  window.gtag("config", "G-4RRVMZ97X0", {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  function loadAnalytics() {
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=G-4RRVMZ97X0";
    document.head.appendChild(script);
  }

  var scheduled = false;
  function scheduleAnalytics() {
    if (scheduled) return;
    scheduled = true;
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
    } else {
      window.setTimeout(loadAnalytics, 0);
    }
  }

  window.addEventListener("pointerdown", scheduleAnalytics, { once: true, passive: true });
  window.addEventListener("keydown", scheduleAnalytics, { once: true, passive: true });
})();
