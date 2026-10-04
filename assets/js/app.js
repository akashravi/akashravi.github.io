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
     Theme toggle (light / dark) with no-flash handled by theme-init.js.
     No stored preference => follows the OS via prefers-color-scheme.
     ------------------------------------------------------------------------ */
  var STORAGE_KEY = "theme";
  var themeToggles = document.querySelectorAll("[data-theme-toggle]");
  var colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  var previewTheme = new URLSearchParams(window.location.search).get("scoutTheme");
  var selectedTheme = null;
  try {
    selectedTheme = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    /* Preferences still work for this visit when storage is unavailable. */
  }
  if (previewTheme === "light" || previewTheme === "dark") selectedTheme = previewTheme;
  if (selectedTheme !== "light" && selectedTheme !== "dark") selectedTheme = null;

  function systemTheme() {
    return colorScheme.matches ? "dark" : "light";
  }

  function currentTheme() {
    return root.getAttribute("data-theme") || systemTheme();
  }

  function syncToggles(theme) {
    var dark = theme === "dark";
    themeToggles.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(dark));
      btn.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    });
  }

  function updateTheme(theme) {
    if (root.getAttribute("data-theme") !== theme) root.setAttribute("data-theme", theme);
    syncToggles(theme);
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      // Measure once enhancement DOM changes are complete, rather than forcing early styling.
      window.requestAnimationFrame(function () {
        themeColor.content = getComputedStyle(root).getPropertyValue("--cp-bg").trim();
      });
    }
  }

  function applyTheme(theme) {
    selectedTheme = theme;
    updateTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* storage unavailable (private mode) — non-fatal */
    }
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

  themeToggles.forEach(function (btn) {
    btn.addEventListener("click", toggleTheme);
  });
  updateTheme(currentTheme());

  /* Keep auto-mode pages in sync if the OS theme changes mid-session. */
  colorScheme.addEventListener("change", function () {
    if (!selectedTheme) updateTheme(systemTheme());
  });
  window.addEventListener("storage", function (event) {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (previewTheme === "light" || previewTheme === "dark") return;
    selectedTheme = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
    updateTheme(selectedTheme || systemTheme());
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
    window.matchMedia("(min-width: 44em)").addEventListener("change", function (event) {
      if (event.matches) setNavOpen(false);
    });
  }

  /* ---------------------------------------------------------------------------
     Sticky header and current-section navigation, coalesced per animation frame.
     ------------------------------------------------------------------------ */
  var header = document.querySelector(".nav");
  var sectionLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav-links a[href^="#"]'),
  );
  var sections = sectionLinks
    .map(function (link) {
      return document.getElementById(link.getAttribute("href").slice(1));
    })
    .filter(Boolean);
  var activeSection = null;
  var scrollScheduled = false;

  function updateScroll() {
    scrollScheduled = false;
    if (header) header.classList.toggle("stuck", window.scrollY > 8);
    if (!sections.length) return;

    var active = null;
    var marker = (header ? header.offsetHeight : 0) + window.innerHeight * 0.25;
    sections.forEach(function (section) {
      if (section.getBoundingClientRect().top <= marker) active = section.id;
    });
    if (window.scrollY + window.innerHeight >= root.scrollHeight - 2) {
      active = sections[sections.length - 1].id;
    }
    if (active === activeSection) return;
    activeSection = active;
    sectionLinks.forEach(function (link) {
      var isActive = link.getAttribute("href") === "#" + active;
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }

  function scheduleScroll() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    window.requestAnimationFrame(updateScroll);
  }

  if (header) {
    scheduleScroll();
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll, { passive: true });
    window.addEventListener("load", scheduleScroll);
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
      root.classList.add("reveal-ready");
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
    var resumeRetry = document.querySelector("[data-resume-retry]");
    var resumeLoading = false;
    var resumeTimer;
    var resumeAttempt = 0;

    var resumeUnavailable = function (attempt) {
      if (attempt !== resumeAttempt) return;
      resumeLoading = false;
      window.clearTimeout(resumeTimer);
      resumeFrame.parentElement.setAttribute("aria-busy", "false");
      resumeFrame.hidden = true;
      if (resumePlaceholder) resumePlaceholder.hidden = false;
      if (resumeSpinner) resumeSpinner.hidden = true;
      if (resumeStatus) {
        resumeStatus.textContent = "The preview is taking too long. Open the résumé or try again.";
      }
      if (resumeRetry) resumeRetry.hidden = false;
    };

    var loadResume = function () {
      if (resumeLoading) return;
      var attempt = ++resumeAttempt;
      var previousFrame = resumeFrame;
      // A fresh browsing context also restarts a stalled, same-URL request in Chromium.
      resumeFrame = previousFrame.cloneNode(false);
      resumeFrame.removeAttribute("src");
      resumeLoading = true;
      resumeFrame.classList.remove("loaded");
      previousFrame.parentElement.setAttribute("aria-busy", "true");
      if (resumePlaceholder) resumePlaceholder.hidden = false;
      if (resumeRetry) resumeRetry.hidden = true;
      if (resumeSpinner) resumeSpinner.hidden = false;
      if (resumeStatus) resumeStatus.textContent = "loading résumé…";
      resumeFrame.addEventListener("load", function () {
        if (!resumeLoading || attempt !== resumeAttempt) return;
        resumeLoading = false;
        window.clearTimeout(resumeTimer);
        resumeFrame.parentElement.setAttribute("aria-busy", "false");
        resumeFrame.classList.add("loaded");
        if (resumeSpinner) resumeSpinner.hidden = true;
        if (resumePlaceholder) resumePlaceholder.hidden = true;
      });
      resumeFrame.addEventListener("error", function () {
        resumeUnavailable(attempt);
      });
      resumeTimer = window.setTimeout(function () {
        resumeUnavailable(attempt);
      }, 15000);
      resumeFrame.hidden = false;
      resumeFrame.setAttribute("src", resumeFrame.getAttribute("data-src"));
      previousFrame.replaceWith(resumeFrame);
    };

    if (resumeRetry) {
      resumeRetry.addEventListener("click", function () {
        loadResume();
        resumeFrame.focus();
      });
    }

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
     Contact form: progressive enhancement over a native Formspree POST.
     Without JS the form still submits normally; with JS we POST via fetch
     and show an inline status without a full page navigation.
     ------------------------------------------------------------------------ */
  var form = document.querySelector("[data-ajax-form]");
  if (form && window.fetch) {
    var status = form.querySelector(".form-status");
    var submitBtn = form.querySelector('[type="submit"]');
    var defaultHTML = submitBtn ? submitBtn.innerHTML : "";
    var sending = false;

    var setStatus = function (message, state) {
      if (!status) return;
      status.textContent = message;
      status.setAttribute("data-state", state || "");
    };

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      sending = true;
      form.setAttribute("aria-busy", "true");
      setStatus("Sending…", "pending");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending…";
      }

      var controller = new AbortController();
      var payload = new FormData(form);
      var submittedDraft = new URLSearchParams(payload).toString();
      var requestTimer = window.setTimeout(function () {
        controller.abort();
      }, 15000);

      fetch(form.action, {
        method: "POST",
        body: payload,
        headers: { Accept: "application/json" },
        signal: controller.signal,
      })
        .then(function (response) {
          if (response.ok) {
            if (new URLSearchParams(new FormData(form)).toString() === submittedDraft) {
              form.reset();
              setStatus(
                "Thanks — your message is on its way. I'll get back to you soon.",
                "success",
              );
            } else {
              setStatus("Message sent. Your newer edits have been kept.", "success");
            }
          } else {
            return response
              .json()
              .catch(function () {
                return null;
              })
              .then(function (data) {
                var messages =
                  data && Array.isArray(data.errors)
                    ? data.errors
                        .filter(function (error) {
                          return error && typeof error.message === "string";
                        })
                        .map(function (error) {
                          return error.message;
                        })
                        .join(" ")
                    : "";
                var fallback =
                  response.status === 429
                    ? "Too many attempts. Please wait a moment or email me directly."
                    : "The message wasn't sent. Please try again or email me directly.";
                setStatus(messages || fallback, "error");
              });
          }
        })
        .catch(function (error) {
          setStatus(
            error.name === "AbortError"
              ? "The request timed out; delivery couldn't be confirmed. Please email me directly."
              : "Couldn't confirm delivery. Check your connection or email me directly.",
            "error",
          );
        })
        .finally(function () {
          window.clearTimeout(requestTimer);
          sending = false;
          form.setAttribute("aria-busy", "false");
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
    var year = String(new Date().getFullYear());
    if (el.textContent !== year) el.textContent = year;
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

  var copyEmail = document.querySelector("[data-copy-email]");
  var emailStatus = document.querySelector("[data-email-status]");
  if (copyEmail && navigator.clipboard && window.isSecureContext) {
    copyEmail.hidden = false;
    copyEmail.addEventListener("click", function () {
      copyEmail.disabled = true;
      navigator.clipboard
        .writeText(emailAddress)
        .then(function () {
          if (emailStatus) emailStatus.textContent = "Email address copied.";
        })
        .catch(function () {
          if (emailStatus) {
            emailStatus.textContent = "Copy isn't available. Select the email address above.";
          }
        })
        .finally(function () {
          copyEmail.disabled = false;
        });
    });
  }

  root.classList.add("js");
})();
