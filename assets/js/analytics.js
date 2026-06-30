/* Google Analytics 4 bootstrap, externalized so the Content-Security-Policy can
   stay strict (script-src 'self' …googletagmanager.com) with no inline scripts.
   The gtag.js library is loaded via an async <script> tag in each page head. */
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-4RRVMZ97X0", { anonymize_ip: true });
