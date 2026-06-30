# Akash Ravi — Portfolio

> Personal site of **Akash Ravi** — Product Manager, SharePoint AI at Microsoft.

[![Deploy](https://img.shields.io/badge/deployed-GitHub%20Pages-blue)](https://akashravi.github.io)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.txt)

**Live:** [akashravi.github.io](https://akashravi.github.io)

A single-page, framework-free static site with an editorial ink-and-amber aesthetic,
a monospaced "spec sheet" signature, and a light/dark theme.

## The one thing to maintain: the résumé

The site is designed so that **the only thing you normally update is your résumé on
Google Drive.** The résumé is embedded live from Drive — update the PDF and the site
reflects it automatically, no code change needed. Everything else in the page is stable
identity (name, role, location, links) that rarely changes.

- **Change the résumé** → just replace/update the PDF in Google Drive.
- **Change identity copy / links** → edit `index.html` (one file).
- **Change colors / type / spacing** → edit the design tokens in `:root` (and the dark
  overrides) at the top of `assets/css/styles.css`.

## Stack

HTML5 · modern CSS (custom-property tokens) · vanilla ES5-safe JavaScript ·
self-hosted variable fonts (Space Grotesk · Inter · JetBrains Mono) · inline SVG icons ·
GitHub Pages. No framework, no build step, no runtime dependencies.

## Structure

```
.
├── index.html              # The whole site (hero · about · résumé · elsewhere · contact)
├── 404.html                # Branded not-found page
├── robots.txt · sitemap.xml
├── favicon.ico
├── assets/
│   ├── css/styles.css      # The design system
│   ├── js/
│   │   ├── theme-init.js   # No-flash theme (blocking, in <head>)
│   │   ├── app.js          # Theme toggle, reveal, active nav, form enhancement
│   │   └── analytics.js    # GA4 bootstrap (externalized for CSP)
│   ├── fonts/              # Self-hosted variable woff2
│   ├── icons/              # SVG favicon + apple-touch icon
│   └── og-image.jpg        # 1200×630 social card
└── .github/workflows/      # CI (lint + Lighthouse), Pages deploy, link check
```

## Local development

```bash
npm start          # serve the site locally
npm run lint       # stylelint + htmlhint + prettier --check
npm run format     # prettier --write
```

## Highlights

- **Accessible** — semantic landmarks, skip link, visible focus, labelled controls,
  `prefers-reduced-motion`, WCAG-minded contrast in both themes.
- **Secure** — strict `Content-Security-Policy` (meta), no inline scripts/styles, only
  self + Google Analytics origins.
- **Discoverable** — canonical, Open Graph / Twitter cards, JSON-LD `Person`, sitemap.
- **Fast** — self-hosted preloaded fonts, inline SVG (no icon font), lazy résumé embed.

## Deployment

Static site published with GitHub Pages' **Deploy from a branch** (serves `master`).
A GitHub Actions deploy workflow is also included at `.github/workflows/deploy.yml`; to use
it, switch **Settings → Pages → Source** to **GitHub Actions**.

## License

[MIT](LICENSE.txt) © Akash Ravi
