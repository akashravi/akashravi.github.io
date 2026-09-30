import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Mustache from "mustache";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const OUTPUT = path.join(ROOT, "dist");

export async function build(root = ROOT) {
  const output = path.join(root, "dist");
  const read = (...parts) => readFile(path.join(root, ...parts), "utf8");
  const readJson = async (...parts) => JSON.parse(await read(...parts));
  const [site, groups, layout, sprite, partialFiles] = await Promise.all([
    readJson("src", "data", "site.json"),
    readJson("src", "data", "profiles.json"),
    read("src", "layout.html"),
    read("assets", "icons", "sprite.svg"),
    readdir(path.join(root, "src", "partials")),
  ]);
  const siteUrl = new URL(site.url);
  if (
    typeof site.title !== "string" ||
    !site.title.trim() ||
    siteUrl.protocol !== "https:" ||
    siteUrl.origin !== site.url ||
    typeof site.resumeId !== "string" ||
    !/^[\w-]+$/.test(site.resumeId)
  ) {
    throw new Error("site.json requires a title, an HTTPS origin, and a valid resumeId.");
  }
  if (!Array.isArray(site.pages) || !site.pages.length) {
    throw new Error("site.json must define at least one page.");
  }
  if (!site.pages.some((page) => page.file === "index.html" && page.home === true)) {
    throw new Error("The page registry requires index.html with home: true.");
  }
  if (!site.pages.some((page) => page.file === "404.html" && page.noindex === true)) {
    throw new Error("The page registry requires 404.html with noindex: true.");
  }

  const icons = Object.create(null);
  const brands = new Set([
    "codechef",
    "codeforces",
    "github",
    "hackerearth",
    "hackerrank",
    "scholar",
  ]);
  for (const [, id] of sprite.matchAll(/<symbol id="([\w-]+)"/g)) {
    if (Object.hasOwn(icons, id)) throw new Error(`Duplicate SVG symbol: ${id}`);
    icons[id] =
      `<svg class="icon ${id}${brands.has(id) ? " icon-brand" : ""}" viewBox="0 0 24 24" aria-hidden="true"><use href="/assets/icons/sprite.svg#${id}"></use></svg>`;
  }
  const profiles = groups.map((group) => ({
    ...group,
    links: group.links.map((link) => {
      const url = new URL(link.url);
      if (
        !icons[link.icon] ||
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        typeof link.name !== "string" ||
        typeof link.detail !== "string"
      ) {
        throw new Error(`Invalid icon or HTTPS URL for profile: ${link.name}`);
      }
      return { ...link, iconMarkup: icons[link.icon] };
    }),
  }));
  const allLinks = profiles.flatMap((group) => group.links);
  const partials = Object.fromEntries(
    await Promise.all(
      partialFiles
        .filter((file) => file.endsWith(".html"))
        .map(async (file) => [path.basename(file, ".html"), await read("src", "partials", file)]),
    ),
  );
  const personJson = JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "Person",
      ...site.person,
      name: site.title,
      url: site.url,
      image: `${site.url}/images/akash.jpg`,
      sameAs: allLinks.map((link) => link.url),
    },
    null,
    2,
  ).replaceAll("<", "\\u003c");
  const files = new Set();
  const validateTemplate = (template, file) => {
    for (const [, partial] of template.matchAll(/\{\{>\s*([\w-]+)\s*\}\}/g)) {
      if (!Object.hasOwn(partials, partial))
        throw new Error(`Unknown partial "${partial}" in ${file}`);
    }
    for (const [, icon] of template.matchAll(/\{\{\{\s*icons\.([\w-]+)\s*\}\}\}/g)) {
      if (!Object.hasOwn(icons, icon)) throw new Error(`Unknown icon "${icon}" in ${file}`);
    }
  };
  for (const [name, template] of Object.entries({ layout, ...partials })) {
    validateTemplate(template, name);
  }
  const pages = await Promise.all(
    site.pages.map(async (page) => {
      if (
        !/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/.test(page.file) ||
        files.has(page.file) ||
        ("home" in page && typeof page.home !== "boolean") ||
        ("noindex" in page && typeof page.noindex !== "boolean") ||
        typeof page.title !== "string" ||
        !page.title.trim() ||
        typeof page.description !== "string" ||
        !page.description.trim()
      ) {
        throw new Error(`Invalid or duplicate page configuration: ${page.file}`);
      }
      files.add(page.file);
      const canonical = `${site.url}/${page.file.replace(/(^|\/)index\.html$/, "$1")}`;
      const context = {
        ...page,
        home: page.home === true,
        noindex: page.noindex === true,
        site,
        profiles,
        icons,
        personJson,
        canonical,
        socialLinks: allLinks.filter((link) => link.social),
        resumeView: `https://drive.google.com/file/d/${site.resumeId}/view`,
        year: new Date().getFullYear(),
        mainId: page.home ? "top" : "main",
        homeLink: page.home ? "#top" : "/",
      };
      const template = await read("src", "pages", ...page.file.split("/"));
      validateTemplate(template, page.file);
      const content = Mustache.render(template, context, partials);
      const html = Mustache.render(layout, { ...context, content }, partials);
      return { ...page, canonical, html };
    }),
  );

  // Only generated output is replaced; templates and source assets are never touched.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await Promise.all(
    ["assets", "images", "favicon.ico"].map((file) =>
      cp(path.join(root, file), path.join(output, file), { recursive: true }),
    ),
  );
  await Promise.all(
    pages.map(async (page) => {
      const destination = path.join(output, ...page.file.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, page.html);
    }),
  );
  const urls = pages
    .filter((page) => !page.noindex)
    .map((page) => `  <url><loc>${Mustache.escape(page.canonical)}</loc></url>`)
    .join("\n");
  await Promise.all([
    writeFile(
      path.join(output, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    ),
    writeFile(
      path.join(output, "robots.txt"),
      `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`,
    ),
    writeFile(path.join(output, ".nojekyll"), ""),
  ]);
  console.log(`Built ${pages.length} pages → dist`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await build();
}
