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
GitHub Pages + Jekyll (shared layout & includes, built by GitHub on push). No client-side
framework, no runtime dependencies.

## Structure

```
.
├── index.html              # Home page: front matter + content sections
├── 404.html                # Not-found page: front matter + content
├── _config.yml             # Jekyll configuration
├── _layouts/
│   └── default.html        # Page skeleton (doctype, <head>, header, footer, scripts)
├── _includes/
│   ├── head.html           # Shared <head> — CSP, meta, fonts, theme, GA
│   ├── header.html         # Brand · nav · theme toggle
│   ├── footer.html         # Footer
│   └── seo.html            # Home-only Open Graph / Twitter / JSON-LD
├── robots.txt · sitemap.xml
├── favicon.ico
├── assets/
│   ├── css/styles.css      # The design system
│   ├── js/
│   │   ├── theme-init.js   # No-flash theme (blocking, in <head>)
│   │   ├── app.js          # Theme toggle, reveal, active nav, form, email
│   │   └── analytics.js    # GA4 bootstrap (externalized for CSP)
│   ├── fonts/              # Self-hosted variable woff2
│   ├── icons/              # SVG favicon + apple-touch icon
│   └── og-image.jpg        # 1200×630 social card
└── .github/workflows/      # CI (build + lint + Lighthouse), Pages deploy, link check
```

The shared page chrome lives in `_layouts/` and `_includes/`, so `index.html` and
`404.html` never repeat the `<head>`, header, or footer. Adding a page = one file with
`layout: default` plus its content.

## Local development

The site is built with [Jekyll](https://jekyllrb.com/) 4; local preview needs Ruby +
Bundler.

```bash
bundle install     # one-time: install Jekyll (from the Gemfile)
npm install        # one-time: dev tooling + activates the format-on-commit hook
npm start          # bundle exec jekyll serve --livereload → http://localhost:4000
npm run build      # bundle exec jekyll build → _site/
npm run lint       # build + stylelint + htmlhint (on _site) + prettier --check
npm run format     # prettier --write
```

A git pre-commit hook (`.githooks/pre-commit`, wired up by `npm install`) runs Prettier
on staged files automatically, so commits are always formatted and CI's format check
can't fail on a stray edit.

## Highlights

- **Accessible** — semantic landmarks, skip link, visible focus, labelled controls,
  `prefers-reduced-motion`, WCAG-minded contrast in both themes.
- **Secure** — strict `Content-Security-Policy` (meta), no inline scripts/styles, only
  self + Google Analytics origins; the email address is assembled client-side, so
  scrapers never see it in the HTML.
- **Discoverable** — canonical, Open Graph / Twitter cards, JSON-LD `Person`, sitemap.
- **Fast** — self-hosted preloaded fonts, inline SVG (no icon font), lazy résumé embed.

## Deployment

Deployed via **GitHub Actions** — `.github/workflows/deploy.yml` builds the site with
Jekyll (from the `Gemfile`) and publishes `_site`. One-time setup: **Settings → Pages →
Source → GitHub Actions**.

## License

[MIT](LICENSE.txt) © Akash Ravi
