/* Runs before first paint (loaded blocking in <head>) to avoid a theme flash.
   Also flags that JS is enabled so CSS can gate scroll-reveal animations —
   without JS, content stays visible. Kept external so the CSP needs no inline
   script allowance. */
(function () {
  try {
    var stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {
    /* localStorage blocked (private mode) — fall back to system theme */
  }
  document.documentElement.classList.add("js");
})();
