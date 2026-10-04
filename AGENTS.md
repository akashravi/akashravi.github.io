# Agent instructions

Read `README.md` for setup, commands, and the source map. This file contains editing
constraints and verification requirements, not a second user guide.

## Content changes

- For project additions, edit only `src\data\projects.json` unless the requested
  feature requires a schema or layout change. Use an existing record as the example.
- Required fields: `id`, `name`, `category`, `context`, `summary`, `technical`,
  `technologies`, `languages`, and `repository`. Optional `action` requires `label`
  and `url`. `prepareProjects` in `scripts\projects.mjs` is the schema authority;
  it rejects unsupported fields and invalid values.
- Preserve existing project IDs. New IDs must be unique lowercase slugs and must
  not collide with page IDs or generated `-title` IDs. URLs must be HTTPS without
  embedded credentials. `languages` lists programming languages, not frameworks.
- Keep `summary` focused on what the project does and `technical` on how it works.
  Use short, plain paragraphs. Do not add role headings, ownership slogans, bottom
  notes, or extra sections to cards.
- Verify new claims against the linked repository or project report and the user's
  corrections. Do not invent adoption, performance, model training, production
  deployment, or completeness.
- Let array order control presentation. Do not hardcode counts, numbering, or jump
  links. Preserve repeated-category support and the native directory above six
  projects; all cards remain rendered.
- If changing the project schema, update validation, the card template, JSON-LD,
  and regression fixtures together.

## UI and build invariants

- Edit source files; never edit or commit generated `dist` output. Reuse Mustache
  partials and existing assets rather than adding a framework for content changes.
- Keep all theme tokens in `assets\css\styles.css`. `assets\css\projects.css` is for
  layout, not a separate palette.
- Keep the navigation breakpoint synchronized between shared CSS and
  `assets\js\app.js` (`44em`).
- Keep footer actions identical across pages. Use `mainId` for the top fragment
  and `contactLink` for the email fallback; do not restore homepage-only branches.
- Preserve keyboard focus, skip links, current-page state, reduced-motion behavior,
  descriptive link names, and navigation without JavaScript.
- Use escaped Mustache values for content and attributes. Reserve triple braces
  for trusted rendered HTML, icons, and safely serialized JSON-LD. Keep executable
  scripts and styles external to preserve the existing CSP.
- Register new pages in `site.json`; retain the homepage's `home: true` and the
  error page's `noindex: true`. Let the build generate canonical URLs and the sitemap.

## Verification

- Content/build changes: run `npm run lint` and `npm run test:unit`.
- UI changes: run relevant Playwright tests. `projects.spec.js` covers cards,
  shared themes, and expanded collections; `portfolio.spec.js` covers the homepage
  and shared navigation/footer. Use targeted selectors when appropriate.
- Keep project tests data-driven; do not assume a fixed number of production
  projects. Retain coverage for long names, repeated categories, optional actions,
  and narrow layouts.
- Documentation-only changes: check the edited Markdown with Prettier; do not run
  browser suites for prose changes.
- Avoid concurrent processes that rebuild the same `dist` directory.
