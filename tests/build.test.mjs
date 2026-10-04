import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { build } from "../scripts/build.mjs";
import { createBuildFixture } from "./helpers/build-fixture.mjs";

async function fixture(t) {
  const result = await createBuildFixture();
  t.after(result.cleanup);
  return result;
}

test("build emits only static pages and public assets, with valid structured data", async (t) => {
  const f = await fixture(t);
  await build(f.root);
  assert.deepEqual((await readdir(path.join(f.root, "dist"))).sort(), [
    ".nojekyll",
    "404.html",
    "assets",
    "favicon.ico",
    "images",
    "index.html",
    "projects",
    "robots.txt",
    "sitemap.xml",
  ]);
  const html = await f.output("index.html");
  assert.doesNotMatch(html, /\{%|\{\{/);
  assert.match(html, /; upgrade-insecure-requests/);
  const person = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(person.url, f.site.url);
  assert.equal(person.name, f.site.title);
  assert.ok(person.sameAs.includes("https://github.com/techtocore"));
  assert.match(await f.output("404.html"), /name="robots" content="noindex"/);
  const sitemap = await f.output("sitemap.xml");
  assert.doesNotMatch(sitemap, /404|lastmod/);
  assert.match(
    await f.output("robots.txt"),
    /Sitemap: https:\/\/akashravi\.github\.io\/sitemap\.xml/,
  );
});

test("new nested pages share the layout, escape copy, and join the sitemap", async (t) => {
  const f = await fixture(t);
  f.site.pages.push({
    file: "writing/index.html",
    title: 'Writing <AI> & "search"',
    description: "Thoughts on useful products.",
  });
  await mkdir(path.join(f.root, "src", "pages", "writing"));
  await writeFile(
    path.join(f.root, "src", "pages", "writing", "index.html"),
    "<section><h1>{{title}}</h1><p>{{description}}</p></section>",
  );
  await f.save();
  await build(f.root);
  const html = await f.output("writing/index.html");
  assert.match(html, /<h1>Writing &lt;AI&gt; &amp; &quot;search&quot;<\/h1>/);
  assert.match(html, /id="main" tabindex="-1"/);
  assert.doesNotMatch(html, /id="primary-navigation"/);
  assert.match(html, /<header class="nav">/);
  assert.match(html, /<footer class="foot">/);
  assert.match(html, /rel="canonical" href=/);
  assert.match(html, /property="og:title" content="Writing &lt;AI&gt; &amp; &quot;search&quot;"/);
  assert.match(
    html,
    /property="og:url" content="https:&#x2F;&#x2F;akashravi\.github\.io&#x2F;writing&#x2F;"/,
  );
  assert.match(await f.output("sitemap.xml"), /writing/);
});

test("projects share one data source for static content and agent-readable structured data", async (t) => {
  const f = await fixture(t);
  await build(f.root);
  const html = await f.output("projects/index.html");
  const home = await f.output("index.html");
  assert.doesNotMatch(html, /\{%|\{\{/);
  assert.match(html, /aria-current="page"[^>]*>Projects/);
  assert.match(html, /href="\/assets\/css\/projects.css"/);
  assert.doesNotMatch(home, /\/assets\/css\/projects.css|class="project-card"/);
  assert.equal((home.match(/href="\/projects\/"/g) || []).length, 2);
  assert.doesNotMatch(html, /My contribution/);
  assert.doesNotMatch(html, /<dt>|<dd>|class="project-note"|Built end to end/);
  assert.match(
    await f.output("sitemap.xml"),
    /https:&#x2F;&#x2F;akashravi\.github\.io&#x2F;projects&#x2F;/,
  );
  const graph = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  )["@graph"];
  const person = graph.find((entry) => entry["@type"] === "Person");
  const collection = graph.find((entry) => entry["@type"] === "CollectionPage");
  assert.equal(collection.url, `${f.site.url}/projects/`);
  assert.equal(collection.author["@id"], person["@id"]);
  assert.equal(collection.mainEntity.numberOfItems, f.projects.length);
  assert.equal(collection.mainEntity.itemListElement.length, f.projects.length);
  for (const [index, project] of f.projects.entries()) {
    assert.match(html, new RegExp(`<article id="${project.id}"`));
    const entry = collection.mainEntity.itemListElement[index];
    assert.equal(entry.position, index + 1);
    assert.equal(entry.item["@type"], "SoftwareSourceCode");
    assert.equal(entry.item.name, project.name);
    assert.equal(entry.item.codeRepository, project.repository);
    assert.equal(entry.item.url, `${collection.url}#${project.id}`);
    assert.deepEqual(entry.item.programmingLanguage, project.languages);
    assert.equal(entry.item.description, `${project.summary} ${project.technical}`);
    assert.deepEqual(entry.item.sameAs, [
      project.repository,
      ...(project.action ? [project.action.url] : []),
    ]);
    assert.equal(entry.item.author["@id"], person["@id"]);
  }
});

test("every registered page shares the same footer with working local top and contact targets", async (t) => {
  const f = await fixture(t);
  await build(f.root);
  const footer = (html) => html.match(/<footer class="foot">[\s\S]*?<\/footer>/)[0];
  const normalize = (html) =>
    footer(html)
      .replace('href="#top"', 'href="#main"')
      .replace('href="#contact"', 'href="&#x2F;#contact"');
  const reference = normalize(await f.output("index.html"));
  for (const page of f.site.pages) {
    const html = await f.output(page.file);
    assert.equal(normalize(html), reference, page.file);
    assert.match(footer(html), new RegExp(`href="#${page.home ? "top" : "main"}"`));
    assert.match(
      footer(html),
      page.home ? /href="#contact"\s+data-email/ : /href="&#x2F;#contact"\s+data-email/,
    );
  }
});

test("adding many projects needs only data changes, even with repeated categories and optional fields omitted", async (t) => {
  const f = await fixture(t);
  const { action, ...base } = f.projects[0];
  for (let index = 1; index <= 20; index++) {
    f.projects.push({ ...base, id: `example-${index}`, name: `Example project ${index}` });
  }
  await f.saveProjects();
  await build(f.root);
  const html = await f.output("projects/index.html");
  assert.equal((html.match(/<article id=/g) || []).length, f.projects.length);
  assert.equal((html.match(/class="project-index-name"/g) || []).length, f.projects.length);
  assert.doesNotMatch(html, /class="project-note"/);
  assert.match(html, /<details class="project-directory">/);
  assert.match(html, new RegExp(`Browse ${f.projects.length} projects`));
  assert.match(html, /href="#example-20"/);
  assert.match(html, /<span class="project-index-name">Example project 20<\/span>/);
  const graph = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  )["@graph"];
  const collection = graph.find((entry) => entry["@type"] === "CollectionPage");
  assert.equal(collection.mainEntity.numberOfItems, f.projects.length);
  const last = collection.mainEntity.itemListElement.at(-1);
  assert.equal(last.position, f.projects.length);
  assert.deepEqual(last.item.sameAs, [base.repository]);
  assert.ok(last.item.description.endsWith(base.technical));
});

test("the named project index stays inline through six entries and collapses starting at seven", async (t) => {
  const f = await fixture(t);
  const base = f.projects[0];
  for (const count of [6, 7]) {
    f.projects.splice(
      0,
      f.projects.length,
      ...Array.from({ length: count }, (_, index) => ({
        ...base,
        id: `boundary-project-${index + 1}`,
        name: `Boundary project ${index + 1}`,
      })),
    );
    await f.saveProjects();
    await build(f.root);
    const html = await f.output("projects/index.html");
    assert.equal(
      (html.match(/<details class="project-directory">/g) || []).length,
      count > 6 ? 1 : 0,
    );
    assert.equal((html.match(/class="project-index-name"/g) || []).length, count);
    assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  }
});

test("project text is escaped in HTML and cannot break out of JSON-LD", async (t) => {
  const f = await fixture(t);
  f.projects[0].summary = "</script><script>alert(1)</script> & {{templates}}";
  await f.saveProjects();
  await build(f.root);
  const html = await f.output("projects/index.html");
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.match(
    html,
    /&lt;&#x2F;script&gt;&lt;script&gt;alert\(1\)&lt;&#x2F;script&gt; &amp; \{\{templates\}\}/,
  );
  const graph = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  )["@graph"];
  assert.ok(
    graph[1].mainEntity.itemListElement[0].item.description.startsWith(f.projects[0].summary),
  );
});

for (const [label, edit] of [
  ["duplicate anchors", (projects) => (projects[1].id = projects[0].id)],
  ["invalid anchors", (projects) => (projects[0].id = "not a slug")],
  ["reserved anchors", (projects) => (projects[0].id = "main")],
  ["heading collisions", (projects) => (projects[1].id = `${projects[0].id}-title`)],
  ["missing technical descriptions", (projects) => delete projects[0].technical],
  ["empty descriptions", (projects) => (projects[0].summary = " ")],
  ["empty technology lists", (projects) => (projects[0].technologies = [])],
  ["invalid languages", (projects) => (projects[0].languages = [""])],
  ["unsupported card fields", (projects) => (projects[0].note = "Extra card copy")],
  ["invalid actions", (projects) => (projects[0].action = { label: "" })],
  ["missing action URLs", (projects) => delete projects[0].action.url],
  ["insecure repository links", (projects) => (projects[0].repository = "http://example.com")],
  ["script URLs", (projects) => (projects[0].action.url = "javascript:alert(1)")],
  [
    "embedded credentials",
    (projects) => (projects[0].action.url = "https://user:pass@example.com"),
  ],
  ["empty selections", (projects) => projects.splice(0)],
  ["invalid records", (projects) => (projects[0] = null)],
]) {
  test(`invalid project data rejects ${label} without replacing the last build`, async (t) => {
    const f = await fixture(t);
    await build(f.root);
    const before = await f.output("projects/index.html");
    edit(f.projects);
    await f.saveProjects();
    await assert.rejects(build(f.root));
    assert.equal(await f.output("projects/index.html"), before);
  });
}

test("JSON-LD cannot be broken out of its script element by content", async (t) => {
  const f = await fixture(t);
  f.site.person.jobTitle = "</script><script>alert(1)</script>";
  await f.save();
  await build(f.root);
  const html = await f.output("index.html");
  assert.doesNotMatch(html, /<\/script><script>alert/);
  const person = JSON.parse(
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
  );
  assert.equal(person.jobTitle, f.site.person.jobTitle);
});

for (const [label, edit] of [
  ["path traversal", (site) => (site.pages[1].file = "../outside.html")],
  ["absolute paths", (site) => (site.pages[1].file = "C:\\outside.html")],
  ["duplicate pages", (site) => site.pages.push({ ...site.pages[0] })],
  ["missing titles", (site) => delete site.pages[0].title],
  ["missing home page", (site) => (site.pages[0].home = false)],
  ["indexable error pages", (site) => (site.pages[1].noindex = false)],
  ["insecure site URLs", (site) => (site.url = "http://example.com")],
  ["invalid résumé IDs", (site) => (site.resumeId = "../invalid")],
]) {
  test(`invalid configuration rejects ${label} without deleting the last build`, async (t) => {
    const f = await fixture(t);
    await build(f.root);
    const before = await f.output("index.html");
    edit(f.site);
    await f.save();
    await assert.rejects(build(f.root));
    assert.equal(await f.output("index.html"), before);
  });
}

test("unknown icons and partials fail explicitly", async (t) => {
  const f = await fixture(t);
  const page = path.join(f.root, "src", "pages", "index.html");
  await writeFile(page, "{{{icons.not-real}}}");
  await assert.rejects(build(f.root), /Unknown icon/);
  await writeFile(page, "{{>not-real}}");
  await assert.rejects(build(f.root), /Unknown partial/);
  await writeFile(page, "{{{icons.toString}}}");
  await assert.rejects(build(f.root), /Unknown icon/);
  await writeFile(page, "{{>toString}}");
  await assert.rejects(build(f.root), /Unknown partial/);
});

test("data can contain literal template characters without being reinterpreted", async (t) => {
  const f = await fixture(t);
  f.site.pages[0].description = "HTML, {{templates}}, and {% other syntaxes %}.";
  await f.save();
  await build(f.root);
  assert.match(await f.output("index.html"), /HTML, \{\{templates\}\}, and \{% other syntaxes %\}/);
});

test("duplicate SVG definitions are rejected rather than rendering ambiguous icons", async (t) => {
  const f = await fixture(t);
  const sprite = path.join(f.root, "assets", "icons", "sprite.svg");
  await writeFile(sprite, '<svg><symbol id="github"></symbol><symbol id="github"></symbol></svg>');
  await assert.rejects(build(f.root), /Duplicate SVG symbol/);
});

test("a rebuild removes stale generated pages", async (t) => {
  const f = await fixture(t);
  await build(f.root);
  await writeFile(path.join(f.root, "dist", "old-page.html"), "old");
  await build(f.root);
  await assert.rejects(f.output("old-page.html"), { code: "ENOENT" });
});
