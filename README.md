# Akash Ravi — Portfolio

> Personal site of **Akash Ravi** — Product Manager, SharePoint AI at Microsoft.

[![Deploy](https://img.shields.io/badge/deployed-GitHub%20Pages-blue)](https://akashravi.github.io)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.txt)

**Live:** [akashravi.github.io](https://akashravi.github.io)

A framework-free portfolio with a warm editorial design, a monospaced "spec sheet"
signature, and accessible themes: warm off-white in light mode, near-black charcoal
with layered surfaces and rose accents in dark mode. One toolchain: **Node.js**. No Ruby,
Jekyll, browser framework, bundler, or client-side dependencies.

## The one thing to maintain: the résumé

The site is designed so that **the only thing you normally update is your résumé on
Google Drive.** The résumé is embedded live from Drive — update the PDF and the site
reflects it automatically, no code change needed. Everything else in the page is stable
identity (name, role, location, links) that rarely changes.

- **Change the résumé** → just replace/update the PDF in Google Drive. (If it ever moves
  to a _different_ Drive file, update `resumeId` in `src/data/site.json`.)
- **Change profiles** → edit `src/data/profiles.json`. Set `social: true` to show a
  profile in the hero, contact section, and footer as well.
- **Change copy** → edit `src/pages/index.html`; titles, descriptions, structured
  identity data, and the site URL live in `src/data/site.json`.
- **Add or change an icon** → edit `assets/icons/sprite.svg`. Each `<symbol>` is
  defined once and available to templates as `{{{icons.symbol-id}}}`.
- **Change colors / type / spacing** → edit the tokens in `assets/css/styles.css`.

## Stack

HTML5 · CSS custom properties · vanilla JavaScript · system fonts · shared SVG
sprite. A small Node build uses **Mustache**, its only build dependency, to render
HTML templates and JSON content into `dist/`. The browser receives plain HTML, CSS,
JavaScript, and images. Node's built-in HTTP server handles local preview.

## Structure

```
.
├── src/
│   ├── layout.html         # Shared page shell
│   ├── pages/              # Page content: index.html, 404.html, future pages
│   ├── partials/           # Shared head, header, footer, SEO, social links
│   └── data/
│       ├── site.json       # Site settings, page registry, résumé id, SEO identity
│       └── profiles.json   # Profile links and social navigation
├── scripts/
│   ├── build.mjs           # Render templates, copy public assets, generate sitemap
│   └── serve.mjs           # Local HTTP preview, optional source watching
├── tests/                  # Browser regression checks, no real form submissions
├── favicon.ico
├── assets/
│   ├── css/styles.css      # The design system
│   ├── js/
│   │   ├── theme-init.js   # No-flash theme (blocking, in <head>)
│   │   ├── app.js          # Theme toggle, reveal, active nav, form, email
│   │   └── analytics.js    # GA4 bootstrap (externalized for CSP)
│   ├── icons/              # SVG sprite, favicon, apple-touch icon
│   └── og-image.jpg        # 1200×630 social card
├── images/                 # Portrait
├── dist/                   # Generated static site; never edit or commit
└── .github/workflows/      # Existing free public-repo checks and Pages publishing
```

**Adding a page:** create its content in `src/pages/` and add a `file`, `title`, and
`description` entry to `pages` in `src/data/site.json`. Nested paths such as
`writing/index.html` work too. Every page gets the shared layout and canonical URL.
Public pages are included in the generated sitemap; `noindex: true` excludes utility
pages. Only the portfolio homepage needs `home: true`.

Templates use ordinary Mustache sections and partials. Text and attributes are escaped
by default; triple braces are reserved for trusted rendered HTML, icons, and generated
JSON-LD. Keep page-specific enhancements in vanilla JavaScript; no framework is needed
to add another content section or page.

## Local development

Install **Node.js 22 or newer** (Node 24 is used by the workflows).

```bash
npm ci             # install the locked development/build tools
npm start          # http://127.0.0.1:4000; rebuilds when content/assets change
npm run build      # production HTML + public assets → dist/
npm run preview    # build and preview without watching
npm run lint       # build + JS/CSS/HTML checks + prettier --check
npm run format     # prettier --write
npx playwright install           # one-time Chromium, Firefox, WebKit setup
npm test           # unit + browser regressions; manages its own local server
```

Refresh the browser after a rebuild. Set the `PORT` environment variable to use a
different local port. The preview server binds only to localhost and returns the
custom 404 page with an actual 404 status.
Only the localhost preview omits CSP's HTTPS-upgrade directive so Safari can load
local HTTP assets; production output keeps the full policy.

Formatting is explicit rather than an auto-restaging commit hook: `npm run format`
never changes your Git index or unexpectedly stages work.

Browser checks cover themes, responsive navigation, résumé loading/recovery, form
success/errors/timeouts, email copying, progressive enhancement, print, and generated
output. Third-party requests are mocked; tests do not send messages or load analytics.
To use an installed Chrome/Edge instead of downloading Chromium, set
`PLAYWRIGHT_CHANNEL` to `chrome` or `msedge` before
`npx playwright test --project=chromium`. Full browser checks also cover Firefox and WebKit.

## Highlights

- **Accessible** — semantic landmarks, skip link, visible focus, labelled controls,
  `prefers-reduced-motion`, WCAG-minded contrast in both themes.
- **Resilient** — content stays visible if enhancement scripts fail; preview timeouts
  offer a retry and an independent résumé link; contact failures preserve your draft.
- **Secure** — strict `Content-Security-Policy` (meta), no inline executable scripts
  or styles. Email links are assembled client-side (obfuscation, not a security control).
- **Discoverable** — canonical, Open Graph / Twitter cards, JSON-LD `Person`, sitemap.
- **Fast** — zero font downloads, one cached SVG sprite, no browser libraries, and a
  responsive WebP portrait with a JPEG fallback. Hero content appears immediately;
  the résumé viewer only loads when its section approaches the viewport.
- **Useful** — résumé open/download actions, copy-email with accessible feedback,
  current-section navigation, printable content, and a back-to-top link.
- **Privacy-aware** — analytics is deferred until interaction, skipped locally, and
  disabled when Do Not Track or Global Privacy Control is enabled.

## Deployment

Deployed via **GitHub Actions** — `.github/workflows/deploy.yml` builds the site with
Node and publishes `dist` on pushes to `main`. One-time setup: **Settings → Pages →
Source → GitHub Actions**.

`ci.yml` runs the build, lints, browser regressions, and Lighthouse budgets for both
themes on each push and pull request. Accessible link names must match their visible
text. Performance uses the median of three runs; the other budgets must hold in
every run. The workflows use standard Ubuntu runners for this public repository.
`links.yml` checks for broken links weekly; hosts that bot-block link
checkers answer with a 403/429 and are accepted rather than treated as failures, and
hosts that can't be checked at all are listed in `.lycheeignore`. Deploying to another
static host only requires publishing `dist/`; no Node server is needed in production.

The portrait variants in `images/` share the same crop and aspect ratio. Replace the
JPEG and both WebP sizes together when updating the photo, along with the social card.

## License

[MIT](LICENSE.txt) © Akash Ravi
