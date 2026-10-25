# Akash Ravi — Portfolio

Source for [akashravi.github.io](https://akashravi.github.io): a static portfolio with
experience, selected projects, profile links, and a contact form.

The site uses HTML, CSS, and vanilla JavaScript. A small Node.js build renders
Mustache templates and JSON content into static files; there is no browser framework
or production Node server.

## Local development

Requires Node.js 22 or newer.

```powershell
npm ci
npm start
```

Open `http://127.0.0.1:4000`. Source changes trigger a rebuild; refresh the browser
to see them. Set `PORT` to use a different port.

| Command             | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `npm run build`     | Generate the production site in `dist`.                  |
| `npm run preview`   | Build and preview without watching for changes.          |
| `npm run lint`      | Build, check JavaScript/CSS/HTML, and verify formatting. |
| `npm run test:unit` | Run build and analytics tests.                           |
| `npm test`          | Run unit tests and browser tests.                        |
| `npm run format`    | Format source files and documentation.                   |

Browser tests use Playwright. Run `npx playwright install` once to install its browsers.
Tests start their own preview server and mock third-party requests, so they do not
submit real contact messages or load analytics.

## Updating content

Edit source files, not the generated `dist` directory.

| What to change                                               | Where                              |
| ------------------------------------------------------------ | ---------------------------------- |
| Homepage text                                                | `src\pages\index.html`             |
| Projects                                                     | `src\data\projects.json`           |
| Profile and social links                                     | `src\data\profiles.json`           |
| Page titles, descriptions, site identity, and résumé file ID | `src\data\site.json`               |
| Shared header, footer, and head markup                       | `src\partials`                     |
| Colors, typography, and shared spacing                       | `assets\css\styles.css`            |
| Projects page layout                                         | `assets\css\projects.css`          |
| Icons                                                        | `assets\icons\sprite.svg`          |
| Portrait and social-preview image                            | `images` and `assets\og-image.jpg` |

To add a project, copy an existing entry in `projects.json` and replace its details.
Give it a new ID, a short introduction, a technical description, tags, and source links.
The array controls display order; cards, navigation, and metadata update automatically.
Keep existing IDs stable because they are also links to individual projects.

The résumé is embedded from Google Drive. Replacing the PDF updates the site without
a rebuild; if the Drive file ID changes, update `resumeId` in `site.json`.
When replacing the portrait, update its JPEG and both WebP variants together.

## How the site is built

```text
src\        Templates, shared partials, and JSON content
assets\     Styles, browser scripts, icons, and the social-preview image
images\     Portrait files
scripts\    Build and local-preview tools
tests\      Unit and browser regression tests
dist\       Generated static output
```

`scripts\build.mjs` renders the pages registered in `src\data\site.json`, copies public
assets, and generates the sitemap. Pages use `src\layout.html` and shared partials by default.
To add a page, create its template under `src\pages` and register its file, title,
and description in `site.json`.

The birthday page at `/for-sathvika/` is registered with `standalone: true` and
`noindex: true`. Its template supplies a complete HTML document instead of the
portfolio layout. It has no portfolio navigation, analytics, or sitemap entry.
This is an unlisted public page, not a password-protected one.

Its source is `src\pages\for-sathvika\index.html`, with layout in
`assets\css\birthday.css`, scoped theme tokens in `assets\css\styles.css`, and
scratch-card behavior in `assets\js\birthday.js`. The original illustration is
`images\birthday-couple.svg`; the reference photograph is not published.
The self-hosted Dancing Script font includes its [SIL Open Font License](assets/fonts/dancing-script/OFL.txt).
No external requests are needed. Without JavaScript or canvas support, the gift
is shown directly; the reveal button also supports keyboard and touch input.
Run `npx playwright test tests/birthday.spec.js` for its browser regressions.

Agent-specific editing rules and validation guidance live in [AGENTS.md](AGENTS.md).

## Deployment

The existing GitHub Pages workflow builds and publishes `dist` on pushes to `main`.
For initial Pages setup, select **Settings → Pages → Source → GitHub Actions**.
Other static hosts can serve the contents of `dist` directly.

## License

[MIT](LICENSE.txt) © Akash Ravi
