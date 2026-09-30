/* External and blocking in <head> to avoid a flash without weakening the CSP. */
(function () {
  var param = new URLSearchParams(window.location.search).get("scoutTheme");
  var theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (param === "light" || param === "dark") {
    theme = param;
  } else {
    try {
      var stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") theme = stored;
    } catch (e) {
      /* localStorage blocked (private mode) — fall back to system theme */
    }
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
