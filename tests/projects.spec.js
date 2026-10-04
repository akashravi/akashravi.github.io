const { test, expect } = require("@playwright/test");
const site = require("../src/data/site.json");
const projects = require("../src/data/projects.json");

async function openProjectDirectory(page) {
  const directory = page.locator(".project-directory");
  if (await directory.count()) {
    await directory.locator("summary").click();
  }
}

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => route.abort());
});

test("projects load as static, sourced content with page-specific metadata and no script errors", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/projects/", { waitUntil: "domcontentloaded" });
  expect(response.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Selected projects.");
  await expect(page.locator(".project-card")).toHaveCount(projects.length);
  await expect(page.getByText("My contribution", { exact: true })).toHaveCount(0);
  await expect(page.locator(".project-card dt, .project-card dd, .project-note")).toHaveCount(0);
  await expect(page.locator("iframe, form, [data-reveal]")).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${site.url}/projects/`,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${site.url}/projects/`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Selected projects — Akash Ravi",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    site.pages.find((entry) => entry.projectsPage).description,
  );
  const graph = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  const collection = graph["@graph"].find((entry) => entry["@type"] === "CollectionPage");
  expect(collection.mainEntity.itemListElement.map((entry) => entry.item.codeRepository)).toEqual(
    projects.map((project) => project.repository),
  );
  for (const project of projects) {
    const card = page.getByRole("article", { name: project.name, exact: true });
    await expect(card.getByRole("heading", { level: 2 })).toHaveText(project.name);
    await expect(card.locator(".project-summary")).toHaveText(project.summary);
    await expect(card.locator(".project-details p")).toHaveCount(1);
    await expect(card.locator(".project-details p")).toHaveText(project.technical);
    await expect(card.locator(".project-details h2, .project-details h3")).toHaveCount(0);
    const source = card.getByRole("link", { name: `Source code for ${project.name}`, exact: true });
    await expect(source).toHaveAttribute("href", project.repository);
    const externalLinks = [source];
    if (project.action) {
      const action = card.getByRole("link", {
        name: `${project.action.label} for ${project.name}`,
        exact: true,
      });
      await expect(action).toHaveAttribute("href", project.action.url);
      externalLinks.push(action);
    }
    for (const link of externalLinks) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
      await expect(link).toHaveAccessibleDescription("Opens in a new tab.");
    }
  }
  for (const asset of ["/assets/css/projects.css", "/assets/icons/sprite.svg"]) {
    expect((await request.get(asset)).status()).toBe(200);
  }
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("projects");
  expect(errors).toEqual([]);
});

test("homepage makes projects discoverable without loading their assets", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('.project-teaser a[href="/projects/"]')).toHaveCount(1);
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Projects", exact: true }),
  ).toHaveAttribute("href", "/projects/");
  await expect(page.locator(".project-teaser a")).toHaveClass(/\bbtn\b/);
  await expect(page.locator(".project-card")).toHaveCount(0);
  expect(requests).not.toContain("/assets/css/projects.css");
  await page.getByRole("link", { name: "Explore projects" }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(
    page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", {
      name: "Projects",
    }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akash Ravi");
});

test("homepage navigation remains visible and fits without JavaScript on narrow and breakpoint widths", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const width of [320, 544, 704]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("http://127.0.0.1:4173/");
      const navigation = page.getByRole("navigation", { name: "Primary" });
      await expect(navigation).toBeVisible();
      await expect(navigation.getByRole("link", { name: "Projects", exact: true })).toBeVisible();
      expect(
        await navigation.locator("a").evaluateAll((elements) =>
          elements.every((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44;
          }),
        ),
      ).toBe(true);
    }
  } finally {
    await context.close();
  }
});

test("keyboard skip link and project index reach the correct content", async ({ page }) => {
  await page.goto("/projects/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const index = page.getByRole("navigation", { name: "Projects on this page" });
  await page.keyboard.press("Tab");
  if (projects.length > 6) {
    await expect(page.locator(".project-directory summary")).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
  }
  await expect(index.getByRole("link", { name: projects[0].name, exact: true })).toBeFocused();
  for (const project of projects) {
    const link = index.getByRole("link", { name: project.name, exact: true });
    await link.focus();
    await expect(link).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#${project.id}$`));
    await expect(page.locator(`[id="${project.id}"]`)).toBeFocused();
    const top = await page
      .locator(`[id="${project.id}"]`)
      .evaluate((card) => card.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(64);
  }
});

for (const theme of ["light", "dark"]) {
  for (const width of [320, 375, 768, 1440]) {
    test(`${theme} projects stay readable without overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/projects/?scoutTheme=${theme}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await openProjectDirectory(page);
      const overflow = await page.locator("body *").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.width > 0 &&
              (rect.right > innerWidth + 1 || rect.left < -1) &&
              !element.classList.contains("skip")
            );
          })
          .map((element) => `${element.tagName}.${element.className}`),
      );
      expect(overflow).toEqual([]);
      for (const project of projects) {
        await expect(page.getByRole("heading", { name: project.name, exact: true })).toBeVisible();
      }
      const targets = await page
        .locator(".project-links a, .project-index a, [data-theme-toggle], .nav-links a")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            label: element.textContent,
            height: element.getBoundingClientRect().height,
          })),
        );
      for (const target of targets) expect(target.height, target.label).toBeGreaterThanOrEqual(44);
    });
  }
}

test("project theme preference persists and synchronizes with the homepage", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/projects/");
  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#151414");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("home and projects share every theme token and surface color in both themes", async ({
  page,
}) => {
  const palette = () =>
    page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        tokens: Object.fromEntries(
          Array.from(root)
            .filter((name) => name.startsWith("--cp-"))
            .map((name) => [name, root.getPropertyValue(name).trim()]),
        ),
        body: getComputedStyle(document.body).backgroundColor,
        header: getComputedStyle(document.querySelector(".nav")).backgroundColor,
        card: getComputedStyle(document.querySelector(".focus-card, .project-card"))
          .backgroundColor,
      };
    });
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?scoutTheme=${theme}`);
    const home = await palette();
    await page.goto(`/projects/?scoutTheme=${theme}`);
    expect(await palette()).toEqual(home);
  }
});

test("mobile Projects navigation goes to the page and does not mark an unrelated section current", async ({
  page,
}) => {
  await page.setViewportSize({ width: 544, height: 900 });
  await page.goto("/");
  await page.locator("[data-nav-toggle]").click();
  const link = page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: "Projects", exact: true });
  await expect(link).not.toHaveAttribute("aria-current");
  await link.click();
  await expect(page).toHaveURL(/\/projects\/$/);
  await expect(page.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("project text and links meet normal-text contrast in both themes", async ({ page }) => {
  const measureContrast = (locator) =>
    locator.evaluateAll((elements) => {
      const rgba = (color) => {
        const channels = color.match(/[\d.]+/g).map(Number);
        return [...channels.slice(0, 3), channels[3] ?? 1];
      };
      const luminance = (rgb) => {
        const channels = rgb
          .map((channel) => channel / 255)
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      return elements.map((element) => {
        let ancestor = element;
        const layers = [];
        while (ancestor) {
          const layer = rgba(getComputedStyle(ancestor).backgroundColor);
          if (layer[3] > 0) layers.push(layer);
          if (layer[3] === 1) break;
          ancestor = ancestor.parentElement;
        }
        if (layers.at(-1)?.[3] !== 1) throw new Error("Expected an opaque page background.");
        const background = layers
          .reverse()
          .reduce(
            (rgb, layer) =>
              rgb.map((channel, index) => layer[index] * layer[3] + channel * (1 - layer[3])),
            [0, 0, 0],
          );
        const values = [
          luminance(background),
          luminance(rgba(getComputedStyle(element).color).slice(0, 3)),
        ].sort((a, b) => b - a);
        return {
          label: element.textContent.trim(),
          ratio: (values[0] + 0.05) / (values[1] + 0.05),
        };
      });
    });
  const text = page.locator(
    ".nav a, .project-intro h1, .project-intro .label, .project-intro .lead, " +
      ".project-index a, .project-category, .project-context, .project-overview h2, " +
      ".project-summary, .project-tags li, .project-details p, " +
      ".project-links a, .project-outro p, .project-outro a",
  );
  for (const theme of ["light", "dark"]) {
    await page.goto(`/projects/?scoutTheme=${theme}`);
    await openProjectDirectory(page);
    for (const contrast of await measureContrast(text)) {
      expect(contrast.ratio, `${theme}: ${contrast.label}`).toBeGreaterThanOrEqual(4.5);
    }
    for (const link of await page.locator(".project-links a, .project-outro a").all()) {
      await link.hover();
      const [contrast] = await measureContrast(link);
      expect(contrast.ratio, `${theme} hover: ${contrast.label}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("project content and navigation work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/projects/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".project-card")).toHaveCount(projects.length);
    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
    const email = page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Email Akash", exact: true });
    await expect(email).toHaveAttribute("href", "/#contact");
    await email.click();
    await expect(page).toHaveURL(/\/#contact$/);
    await page.goto("http://127.0.0.1:4173/projects/");
    await openProjectDirectory(page);
    const last = projects.at(-1);
    await page
      .getByRole("navigation", { name: "Projects on this page" })
      .getByRole("link", { name: last.name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`#${last.id}$`));
    await expect(page.locator(`[id="${last.id}"]`)).toBeVisible();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.locator('.project-teaser a[href="/projects/"]')).toBeVisible();
  } finally {
    await context.close();
  }
});

test("print retains project descriptions and source URLs in a light palette", async ({ page }) => {
  await page.goto("/projects/?scoutTheme=dark");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".nav")).toBeHidden();
  await expect(page.locator(".project-index")).toBeHidden();
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".project-card").first()).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  for (const project of projects) {
    await expect(page.locator(`[id="${project.id}"] .project-details p`)).toHaveText(
      project.technical,
    );
    const link = page.locator(`[id="${project.id}"] .project-source`);
    expect(
      await link.evaluate((element) => getComputedStyle(element, "::after").content),
    ).toContain(project.repository);
  }
});

test("expanded projects stay navigable and responsive without changing templates or adding JavaScript", async ({
  page,
}) => {
  const { createBuildFixture } = await import("./helpers/build-fixture.mjs");
  const { build } = await import("../scripts/build.mjs");
  const fixture = await createBuildFixture();
  try {
    const { action, ...base } = projects[0];
    fixture.projects.splice(
      0,
      fixture.projects.length,
      ...Array.from({ length: 20 }, (_, index) => ({
        ...base,
        id: `scale-project-${index + 1}`,
        name:
          index === 0
            ? "A deliberately long project name that wraps gracefully while keeping every navigation item readable"
            : `Scale project ${index + 1}`,
        category: "Developer tools",
        technologies: ["TypeScript", "An-intentionally-long-technology-name-for-wrapping"],
      })),
    );
    await fixture.saveProjects();
    await build(fixture.root);
    const html = (await fixture.output("projects/index.html")).replace(
      "; upgrade-insecure-requests",
      "",
    );
    await page.route(/\/projects\/(?:\?|$)/, (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/projects/");
      await expect(page.locator(".project-card")).toHaveCount(20);
      await expect(page.locator(".project-note")).toHaveCount(0);
      await expect(page.locator(".project-links .btn")).toHaveCount(0);
      const directory = page.locator(".project-directory");
      await expect(directory).not.toHaveAttribute("open");
      await directory.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(directory).toHaveAttribute("open", "");
      await expect(directory.locator("a")).toHaveCount(20);
      const overflow = await page.locator(".projects-page *").evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.width && (rect.right > innerWidth + 1 || rect.left < -1);
          })
          .map((element) => element.className),
      );
      expect(overflow).toEqual([]);
      await directory.getByRole("link", { name: "Scale project 20", exact: true }).click();
      await expect(page).toHaveURL(/#scale-project-20$/);
      await expect(page.locator("#scale-project-20")).toBeVisible();
      await expect(page.locator("#scale-project-20")).toBeFocused();
      await page.getByRole("link", { name: "Back to top", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    }
  } finally {
    await fixture.cleanup();
  }
});
