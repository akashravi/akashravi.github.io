import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build, ROOT } from "../scripts/build.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    ["src", "assets", "images", "favicon.ico"].map((file) =>
      cp(path.join(ROOT, file), path.join(root, file), { recursive: true }),
    ),
  );
  const sitePath = path.join(root, "src", "data", "site.json");
  const site = JSON.parse(await readFile(sitePath, "utf8"));
  return {
    root,
    site,
    save: () => writeFile(sitePath, JSON.stringify(site)),
    output: (file) => readFile(path.join(root, "dist", file), "utf8"),
  };
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
  assert.match(await f.output("sitemap.xml"), /writing/);
});

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
