/* Google Analytics 4 bootstrap, externalized so the Content-Security-Policy can
   stay strict (script-src 'self' …googletagmanager.com) with no inline scripts.
   The gtag.js library is loaded via an async <script> tag in each page head. */
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
/* anonymize_ip + no Google Signals / ad personalization: privacy-friendly, and
   it stops GA's cross-domain pings to analytics.google.com / doubleclick.net that
   the strict Content-Security-Policy (rightly) blocks. */
gtag("config", "G-4RRVMZ97X0", {
  anonymize_ip: true,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
});
