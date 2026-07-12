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
     Compact navigation menu on narrow screens.
     ------------------------------------------------------------------------ */
  var navToggle = document.querySelector("[data-nav-toggle]");
  var primaryNav = document.getElementById("primary-navigation");
  if (navToggle && primaryNav) {
    var setNavOpen = function (open) {
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      primaryNav.classList.toggle("open", open);
    };

    navToggle.addEventListener("click", function () {
      setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
    });
    primaryNav.addEventListener("click", function (event) {
      if (event.target.closest("a")) setNavOpen(false);
    });
    document.addEventListener("click", function (event) {
      if (!navToggle.contains(event.target) && !primaryNav.contains(event.target))
        setNavOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setNavOpen(false);
        navToggle.focus();
      }
    });
    window.matchMedia("(min-width: 34em)").addEventListener("change", function (event) {
      if (event.matches) setNavOpen(false);
    });
  }

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
     Load the third-party résumé viewer only when it is close to the viewport.
     Native iframe lazy-loading starts too early for this large embed.
     ------------------------------------------------------------------------ */
  var resumeFrame = document.querySelector("[data-resume-frame]");
  if (resumeFrame) {
    var resumePlaceholder = document.querySelector("[data-resume-placeholder]");
    var resumeSpinner = document.querySelector("[data-resume-spinner]");
    var resumeStatus = document.querySelector("[data-resume-status]");
    var loadResume = function () {
      if (resumeFrame.getAttribute("src")) return;
      if (resumeSpinner) resumeSpinner.hidden = false;
      if (resumeStatus) resumeStatus.textContent = "loading résumé…";
      resumeFrame.addEventListener(
        "load",
        function () {
          resumeFrame.classList.add("loaded");
          if (resumePlaceholder) resumePlaceholder.hidden = true;
        },
        { once: true },
      );
      resumeFrame.hidden = false;
      resumeFrame.setAttribute("src", resumeFrame.getAttribute("data-src"));
    };

    if ("IntersectionObserver" in window) {
      var resumeObserver = new IntersectionObserver(
        function (entries, observer) {
          if (
            entries.some(function (entry) {
              return entry.isIntersecting;
            })
          ) {
            loadResume();
            observer.disconnect();
          }
        },
        { rootMargin: "200px 0px", threshold: 0 },
      );
      resumeObserver.observe(resumeFrame.parentElement);
    } else {
      loadResume();
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

  /* ---------------------------------------------------------------------------
     Email links, assembled at runtime so scrapers never see the address in the
     static HTML. [data-email] elements get a mailto: href; those that also carry
     [data-email-text] have the address rendered as their text. Without JS they
     keep their default href (#contact) and fall back to the contact form.
     ------------------------------------------------------------------------ */
  var emailAddress = "moc.liamg@ivarkhsaka".split("").reverse().join("");
  document.querySelectorAll("[data-email]").forEach(function (link) {
    link.setAttribute("href", "mailto:" + emailAddress);
    if (link.hasAttribute("data-email-text")) {
      link.textContent = emailAddress;
    }
  });
})();
