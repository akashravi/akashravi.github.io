/* =============================================================================
   Akash Ravi — portfolio interactions
   Vanilla JS, no dependencies. Progressive enhancement: the site is fully
   functional without this file; everything here only adds polish.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------------------
     Theme toggle (light / dark) with no-flash handled inline in <head>.
     No stored preference => follows the OS via prefers-color-scheme.
     ------------------------------------------------------------------------ */
  var STORAGE_KEY = "theme";

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || systemTheme();
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage unavailable (private mode) — non-fatal */
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(theme === "dark"));
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      );
    });
  }

  function toggleTheme() {
    var next = currentTheme() === "dark" ? "light" : "dark";
    if (!prefersReducedMotion.matches && typeof document.startViewTransition === "function") {
      document.startViewTransition(function () {
        applyTheme(next);
      });
    } else {
      applyTheme(next);
    }
  }

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", toggleTheme);
    btn.setAttribute("aria-pressed", String(currentTheme() === "dark"));
    btn.setAttribute(
      "aria-label",
      currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme",
    );
  });

  /* Keep auto-mode pages in sync if the OS theme changes mid-session. */
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {}
    if (stored !== "light" && stored !== "dark") {
      root.removeAttribute("data-theme");
    }
  });

  /* ---------------------------------------------------------------------------
     Sticky header shadow once scrolled past the top.
     ------------------------------------------------------------------------ */
  var header = document.querySelector(".nav");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("stuck", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------------------
     Reveal-on-scroll. Falls back to fully visible without IntersectionObserver.
     ------------------------------------------------------------------------ */
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if ("IntersectionObserver" in window && !prefersReducedMotion.matches) {
      var revealObserver = new IntersectionObserver(
        function (entries, obs) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              obs.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
      revealEls.forEach(function (el) {
        revealObserver.observe(el);
      });
    } else {
      revealEls.forEach(function (el) {
        el.classList.add("in");
      });
    }
  }

  /* ---------------------------------------------------------------------------
     Active section highlighting in the nav (index page).
     ------------------------------------------------------------------------ */
  var sectionLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href^="#"]'),
  );
  if (sectionLinks.length && "IntersectionObserver" in window) {
    var linkFor = {};
    var sections = [];
    sectionLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var section = document.getElementById(id);
      if (section) {
        linkFor[id] = link;
        sections.push(section);
      }
    });
    var navObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            sectionLinks.forEach(function (l) {
              l.classList.remove("active");
              l.removeAttribute("aria-current");
            });
            var active = linkFor[entry.target.id];
            if (active) {
              active.classList.add("active");
              active.setAttribute("aria-current", "true");
            }
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach(function (section) {
      navObserver.observe(section);
    });
  }

  /* ---------------------------------------------------------------------------
     Contact form: progressive enhancement over a native Formspree POST.
     Without JS the form still submits normally; with JS we POST via fetch
     and show an inline status without a full page navigation.
     ------------------------------------------------------------------------ */
  var form = document.querySelector("[data-ajax-form]");
  if (form && window.fetch) {
    var status = form.querySelector(".form-status");
    var submitBtn = form.querySelector('[type="submit"]');
    var defaultHTML = submitBtn ? submitBtn.innerHTML : "";

    var setStatus = function (message, state) {
      if (!status) return;
      status.textContent = message;
      status.setAttribute("data-state", state || "");
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      setStatus("Sending…", "pending");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      })
        .then(function (response) {
          if (response.ok) {
            form.reset();
            setStatus("Thanks — your message is on its way. I'll get back to you soon.", "success");
          } else {
            return response.json().then(function (data) {
              var msg =
                data && data.errors
                  ? data.errors
                      .map(function (e) {
                        return e.message;
                      })
                      .join(", ")
                  : "Something went wrong. Please try again or email me directly.";
              setStatus(msg, "error");
            });
          }
        })
        .catch(function () {
          setStatus("Network error. Please try again or email me directly.", "error");
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = defaultHTML;
          }
        });
    });
  }

  /* ---------------------------------------------------------------------------
     Current year in the footer.
     ------------------------------------------------------------------------ */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
