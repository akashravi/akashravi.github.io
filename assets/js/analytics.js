/* Google Analytics 4 bootstrap, externalized so the Content-Security-Policy can
  stay strict (script-src 'self' …googletagmanager.com) with no inline scripts. */
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
});
gtag("js", new Date());
/* anonymize_ip + no Google Signals / ad personalization: privacy-friendly, and
   it stops GA's cross-domain pings to analytics.google.com / doubleclick.net that
   the strict Content-Security-Policy (rightly) blocks. */
gtag("config", "G-4RRVMZ97X0", {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
});

function loadAnalytics() {
  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-4RRVMZ97X0";
  document.head.appendChild(script);
}

var analyticsScheduled = false;
function scheduleAnalytics() {
  if (analyticsScheduled) return;
  analyticsScheduled = true;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
  } else {
    window.setTimeout(loadAnalytics, 0);
  }
}

window.addEventListener("pointerdown", scheduleAnalytics, { once: true, passive: true });
window.addEventListener("keydown", scheduleAnalytics, { once: true, passive: true });
