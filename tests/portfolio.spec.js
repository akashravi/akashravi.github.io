const { test, expect } = require("@playwright/test");
const site = require("../src/data/site.json");

const previewHtml =
  "<!doctype html><html lang='en'><title>Resume fixture</title><p>Resume preview</p></html>";

test.beforeEach(async ({ context }) => {
  await context.route("https://**/*", (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "drive.google.com") {
      return route.fulfill({ contentType: "text/html", body: previewHtml });
    }
    if (host === "www.googletagmanager.com") {
      return route.fulfill({ contentType: "text/javascript", body: "" });
    }
    return route.abort();
  });
});

async function home(page, url = "/") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/\bjs\b/);
}

async function draft(page) {
  await home(page, "/#contact");
  await page.getByLabel("Name", { exact: true }).fill("Portfolio visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.com");
  await page.getByLabel("Subject", { exact: true }).fill("An interesting problem");
  await page
    .getByLabel("Message", { exact: true })
    .fill("A test draft, never sent to a real service.");
}

test("homepage loads without script/CSP errors, with complete local assets and metadata", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await home(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akash Ravi");
  await expect(page.locator(".hero [data-reveal]")).toHaveCount(0);
  await expect(page.locator(".focus-card")).toHaveCount(3);
  await expect(page.locator(".ext")).toHaveCount(10);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${site.url}/`);
  const person = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(person.url).toBe(site.url);
  expect(person.sameAs).toContain("https://github.com/techtocore");
  await expect
    .poll(() =>
      page.locator(".portrait img").evaluate((img) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  const portrait = await page.locator(".portrait img").evaluate(async (img) => {
    // Decode the selected file without srcset's density-corrected intrinsic dimensions.
    const source = new Image();
    source.src = img.currentSrc;
    await source.decode();
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
      requiredWidth: img.getBoundingClientRect().width * devicePixelRatio,
    };
  });
  expect(portrait.width).toBeGreaterThanOrEqual(portrait.requiredWidth);
  expect(portrait.width / portrait.height).toBe(4 / 5);
  const paths = await page
    .locator("[src], [srcset], use[href], link[href]")
    .evaluateAll((elements) =>
      [
        ...new Set(
          elements.flatMap((element) =>
            element.hasAttribute("srcset")
              ? element
                  .getAttribute("srcset")
                  .split(",")
                  .map((candidate) => candidate.trim().split(/\s+/)[0])
              : [element.getAttribute("src") || element.getAttribute("href")],
          ),
        ),
      ]
        .filter((url) => url && url.startsWith("/"))
        .map((url) => url.split("#")[0]),
    );
  for (const asset of paths) {
    const response = await request.get(asset);
    expect(response.status(), asset).toBe(200);
  }
  const symbols = await request.get("/assets/icons/sprite.svg");
  const symbolIds = new Set(
    [...(await symbols.text()).matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]),
  );
  const uses = await page
    .locator("use")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href").split("#")[1]),
    );
  for (const icon of uses) expect(symbolIds.has(icon), icon).toBe(true);
  expect(errors).toEqual([]);
});

test("profile links use their visible content as names and describe new tabs", async ({ page }) => {
  await home(page);
  const links = page.locator(".ext");
  for (const link of await links.all()) {
    const name = await link.locator(".t b").textContent();
    const detail = await link.locator(".t span").textContent();
    await expect(link).toHaveAccessibleName(`${name} ${detail}`);
    await expect(link).toHaveAccessibleDescription("Opens in a new tab.");
    await expect(link).not.toHaveAttribute("aria-label");
  }
  await expect(
    page.getByRole("link", { name: "Open résumé", exact: true }),
  ).toHaveAccessibleDescription("Opens in a new tab.");
});

test("system theme changes synchronize colors, labels, pressed state, and browser chrome", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await home(page);
  const toggle = page.locator("[data-theme-toggle]");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-label", "Switch to light theme");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#151414");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("manual theme survives reload and does not follow later system changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await home(page);
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("dark theme has near-black surfaces, readable text, and distinct accessible controls", async ({
  page,
}) => {
  await home(page, "/?scoutTheme=dark");
  const palette = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const token = (name) => root.getPropertyValue(`--cp-${name}`).trim();
    const luminance = (hex) => {
      const channels = hex
        .slice(1)
        .match(/../g)
        .map((channel) => parseInt(channel, 16) / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const contrast = (a, b) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const cssHex = (color) => {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return `#${Array.from(context.getImageData(0, 0, 1, 1).data)
        .slice(0, 3)
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`;
    };
    const input = getComputedStyle(document.querySelector("#c-name"));
    const backgrounds = ["bg", "bg-elevated", "surface", "surface-soft"];
    return {
      surfaces: backgrounds.map((name) => ({ name, luminance: luminance(token(name)) })),
      textContrasts: backgrounds.flatMap((background) =>
        ["text", "text-soft", "text-muted", "accent", "accent-hover"].map((foreground) => ({
          pair: `${foreground} on ${background}`,
          ratio: contrast(token(foreground), token(background)),
        })),
      ),
      buttonContrast: contrast(token("accent-fg"), token("accent")),
      hoverButtonContrast: contrast(token("accent-fg"), token("accent-hover")),
      controlBorderContrast: contrast(cssHex(input.borderTopColor), cssHex(input.backgroundColor)),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      cardBackground: getComputedStyle(document.querySelector(".focus-card")).backgroundColor,
      inputBackground: getComputedStyle(document.querySelector("#c-name")).backgroundColor,
    };
  });
  expect(palette.bodyBackground).toBe("rgb(21, 20, 20)");
  expect(palette.cardBackground).toBe("rgb(34, 31, 30)");
  expect(palette.inputBackground).toBe(palette.cardBackground);
  expect(palette.surfaces[0].luminance).toBeLessThan(0.01);
  for (const surface of palette.surfaces) {
    expect(surface.luminance, surface.name).toBeLessThan(0.025);
  }
  for (let i = 1; i < palette.surfaces.length; i++) {
    expect(palette.surfaces[i].luminance).toBeGreaterThan(palette.surfaces[i - 1].luminance);
  }
  for (const contrast of palette.textContrasts) {
    expect(contrast.ratio, contrast.pair).toBeGreaterThanOrEqual(4.5);
  }
  expect(palette.buttonContrast).toBeGreaterThanOrEqual(4.5);
  expect(palette.hoverButtonContrast).toBeGreaterThanOrEqual(4.5);
  expect(palette.controlBorderContrast).toBeGreaterThanOrEqual(3);

  const input = page.locator("#c-name");
  await input.focus();
  await expect(input).toHaveCSS("outline-color", "rgb(253, 142, 161)");
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(247, 244, 239)");
});

test("theme preview query takes precedence without overwriting stored preferences", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await home(page, "/?scoutTheme=dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("light");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("invalid theme preferences are ignored", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "invalid"));
  await page.emulateMedia({ colorScheme: "light" });
  await home(page, "/?scoutTheme=invalid");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("blocked storage does not break interactions or forget this visit's manual theme", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await page.emulateMedia({ colorScheme: "light" });
  await home(page);
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("preferences synchronize between tabs and clearing storage restores automatic mode", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await home(page);
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "light" });
  await home(other);
  await page.locator("[data-theme-toggle]").click();
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => localStorage.clear());
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

test("mobile navigation works by keyboard, escape, outside click, link selection, and resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await home(page);
  const toggle = page.locator("[data-nav-toggle]");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav).toBeHidden();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(nav).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "About", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(nav).toBeHidden();
  await toggle.click();
  await page.getByRole("heading", { level: 1 }).click({ position: { x: 8, y: 8 } });
  await expect(nav).toBeHidden();
  await toggle.click();
  await nav.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(nav).toBeHidden();
  await expect(page).toHaveURL(/#contact$/);
  await toggle.click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(nav).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(nav).toBeHidden();
});

test("section navigation stays accurate in tall sections, at the bottom, and on return to top", async ({
  page,
}) => {
  await home(page);
  const nav = page.getByRole("navigation", { name: "Primary" });
  await page.locator("#resume").evaluate((element) => element.scrollIntoView());
  await expect(nav.locator('[aria-current="location"]')).toHaveAttribute("href", "#resume");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(nav.locator('[aria-current="location"]')).toHaveAttribute("href", "#contact");
  await page.getByRole("link", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(nav.locator("[aria-current]")).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`footer groups its actions cleanly at ${width}px and back-to-top works by keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await home(page, "/?scoutTheme=dark");
    const footer = page.getByRole("contentinfo");
    const actions = footer.locator(".foot-actions");
    const backToTop = actions.getByRole("link", { name: "Back to top", exact: true });
    await footer.scrollIntoViewIfNeeded();
    await expect(actions.locator(".social-links a")).toHaveCount(3);
    const boxes = await footer.evaluate((element) => {
      const box = (selector) => {
        const rect = element.querySelector(selector).getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
        };
      };
      return {
        copyright: box("p"),
        actions: box(".foot-actions"),
        socials: box(".social-links"),
        utility: box(".back-top"),
      };
    });
    expect(boxes.utility.height).toBeGreaterThanOrEqual(44);
    expect(boxes.utility.left).toBeGreaterThan(boxes.socials.right);
    expect(
      Math.abs(
        boxes.utility.top +
          boxes.utility.height / 2 -
          (boxes.socials.top + boxes.socials.height / 2),
      ),
    ).toBeLessThanOrEqual(1);
    if (width === 320) {
      expect(boxes.actions.top).toBeGreaterThan(boxes.copyright.bottom);
    } else {
      expect(boxes.actions.left).toBeGreaterThan(boxes.copyright.right);
    }
    await backToTop.focus();
    await expect(backToTop).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#top$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
}

test("résumé viewer loads near its section, uses the same live document for every action", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("drive.google.com")) requests.push(request.url());
  });
  await home(page);
  const frame = page.locator("[data-resume-frame]");
  await expect(frame).not.toHaveAttribute("src");
  expect(requests).toHaveLength(0);
  await page.locator("#resume").evaluate((element) => element.scrollIntoView());
  await expect(frame).toHaveClass(/loaded/);
  await expect(page.locator("[data-resume-placeholder]")).toBeHidden();
  await expect(page.locator(".doc-frame")).toHaveAttribute("aria-busy", "false");
  await expect(frame).toHaveAttribute(
    "src",
    `https://drive.google.com/file/d/${site.resumeId}/preview`,
  );
  await expect(page.getByRole("link", { name: "Open résumé", exact: true })).toHaveAttribute(
    "href",
    `https://drive.google.com/file/d/${site.resumeId}/view`,
  );
  const download = new URL(
    await page.getByRole("link", { name: "Download PDF" }).getAttribute("href"),
  );
  expect(download.searchParams.get("id")).toBe(site.resumeId);
  expect(download.searchParams.get("export")).toBe("download");
});

test("résumé timeout offers a working retry rather than an endless spinner", async ({ page }) => {
  await page.clock.install();
  const requests = [];
  await page.route("https://drive.google.com/**", (route) => {
    requests.push(route);
  });
  await home(page);
  await page.locator("#resume").evaluate((element) => element.scrollIntoView());
  await expect(page.locator("[data-resume-status]")).toHaveText("loading résumé…");
  await page.clock.fastForward(15001);
  await expect(page.getByRole("button", { name: "Retry preview" })).toBeVisible();
  await expect(page.locator("[data-resume-spinner]")).toBeHidden();
  await expect(page.locator("[data-resume-frame]")).toBeHidden();
  await page.getByRole("button", { name: "Retry preview" }).click();
  await expect.poll(() => requests.length).toBe(2);
  await requests[1].fulfill({ contentType: "text/html", body: previewHtml });
  await expect(page.locator("[data-resume-frame]")).toHaveClass(/loaded/);
  await expect(page.locator("[data-resume-placeholder]")).toBeHidden();
});

test("form success posts the draft once, clears it, and restores the send control", async ({
  page,
}) => {
  let sent;
  await page.route("https://formspree.io/**", (route) => {
    sent = route.request();
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await draft(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-status")).toHaveAttribute("data-state", "success");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "false");
  expect(sent.method()).toBe("POST");
  expect(sent.headers().accept).toBe("application/json");
  expect(sent.postData()).toContain("visitor@example.com");
  expect(sent.postData()).toContain("An interesting problem");
});

for (const [name, response, message] of [
  [
    "structured validation errors",
    {
      status: 422,
      contentType: "application/json",
      body: '{"errors":[{"message":"Please check your email."}]}',
    },
    "Please check your email.",
  ],
  [
    "HTML server errors",
    { status: 503, contentType: "text/html", body: "<html>Unavailable</html>" },
    "The message wasn't sent.",
  ],
  [
    "malformed error objects",
    { status: 400, contentType: "application/json", body: '{"errors":[null,{"other":"bad"}]}' },
    "The message wasn't sent.",
  ],
  [
    "rate limits",
    { status: 429, contentType: "application/json", body: "{}" },
    "Too many attempts.",
  ],
]) {
  test(`form preserves drafts and reports ${name}`, async ({ page }) => {
    await page.route("https://formspree.io/**", (route) => route.fulfill(response));
    await draft(page);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".form-status")).toHaveAttribute("data-state", "error");
    await expect(page.locator(".form-status")).toContainText(message);
    await expect(page.getByLabel("Message", { exact: true })).toHaveValue(
      "A test draft, never sent to a real service.",
    );
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  });
}

test("network errors preserve the draft without making a false delivery claim", async ({
  page,
}) => {
  await page.route("https://formspree.io/**", (route) => route.abort("failed"));
  await draft(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".form-status")).toContainText("Couldn't confirm delivery.");
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("An interesting problem");
});

test("form timeout aborts at 15 seconds and duplicate submit events cannot send twice", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    window.__submissions = 0;
    const fetch = window.fetch;
    window.fetch = (url, options) => {
      if (!String(url).includes("formspree.io")) return fetch(url, options);
      window.__submissions++;
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          window.__requestAborted = true;
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    };
  });
  await draft(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole("button", { name: "Send message" }).click();
  await page
    .locator("form")
    .evaluate((form) => form.dispatchEvent(new Event("submit", { cancelable: true })));
  expect(await page.evaluate(() => window.__submissions)).toBe(1);
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await page.clock.fastForward(14999);
  await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
  await page.clock.fastForward(2);
  await expect(page.locator(".form-status")).toContainText("delivery couldn't be confirmed");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  expect(await page.evaluate(() => window.__requestAborted)).toBe(true);
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("An interesting problem");
});

test("native required-field validation blocks empty submissions", async ({ page }) => {
  let submissions = 0;
  await page.route("https://formspree.io/**", (route) => {
    submissions++;
    return route.abort();
  });
  await home(page, "/#contact");
  await page.getByRole("button", { name: "Send message" }).click();
  expect(submissions).toBe(0);
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
});

test("a successful send cannot erase edits made while the request was pending", async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    const fetch = window.fetch;
    window.fetch = (url, options) => {
      if (!String(url).includes("formspree.io")) return fetch(url, options);
      return new Promise((resolve) => {
        setTimeout(() => resolve(new Response("{}", { status: 200 })), 2000);
      });
    };
  });
  await draft(page);
  await page.getByRole("button", { name: "Send message" }).click();
  await page.getByLabel("Message", { exact: true }).fill("A newer unsent draft.");
  await page.clock.fastForward(2001);
  await expect(page.locator(".form-status")).toHaveText(
    "Message sent. Your newer edits have been kept.",
  );
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("A newer unsent draft.");
});

test("copy-email succeeds with accessible feedback and leaves email links functional", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (value) => {
          window.__copiedEmail = value;
        },
      },
    });
  });
  await home(page, "/#contact");
  await page.getByRole("button", { name: "Copy email" }).click();
  const address = await page.locator("[data-email-text]").textContent();
  expect(await page.evaluate(() => window.__copiedEmail)).toBe(address);
  await expect(page.locator("[data-email-status]")).toHaveText("Email address copied.");
  await expect(page.locator("[data-email-text]")).toHaveAttribute("href", `mailto:${address}`);
});

test("clipboard rejection is actionable and the control remains usable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    });
  });
  await home(page, "/#contact");
  await page.getByRole("button", { name: "Copy email" }).click();
  await expect(page.locator("[data-email-status]")).toContainText(
    "Select the email address above.",
  );
  await expect(page.getByRole("button", { name: "Copy email" })).toBeEnabled();
});

test("missing clipboard and IntersectionObserver APIs degrade gracefully", async ({ page }) => {
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
    Object.defineProperty(navigator, "clipboard", { value: undefined });
  });
  await home(page);
  await expect(page.locator("[data-copy-email]")).toBeHidden();
  await expect(page.locator("[data-resume-frame]")).toHaveClass(/loaded/);
  const faded = await page.locator("[data-reveal]").evaluateAll((elements) =>
    elements
      .filter((element) => getComputedStyle(element).opacity !== "1")
      .map((element) => ({
        element: element.className,
        opacity: getComputedStyle(element).opacity,
        display: getComputedStyle(element).display,
      })),
  );
  expect(faded).toEqual([]);
});

for (const width of [320, 375, 544, 768, 1024, 1440]) {
  test(`layout has no horizontal overflow at ${width}px and keeps touch targets usable`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await home(page);
    const overflowing = await page.locator("body *").evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width &&
            (rect.right > innerWidth + 1 || rect.left < -1) &&
            !element.closest(".hp") &&
            !element.classList.contains("skip")
          );
        })
        .map((element) => `${element.tagName}.${element.className}`),
    );
    expect(overflowing).toEqual([]);
    const target = await page.locator("[data-theme-toggle]").boundingBox();
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  });
}

test("no JavaScript keeps navigation, content, native form, and résumé actions accessible", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4173/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.locator("[data-theme-toggle]")).toBeHidden();
    await expect(page.locator("[data-copy-email]")).toBeHidden();
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await expect(page.getByRole("link", { name: "Open résumé", exact: true })).toHaveAttribute(
      "href",
      /drive\.google\.com/,
    );
    expect(
      await page
        .locator("[data-reveal]")
        .evaluateAll((elements) =>
          elements.every((element) => getComputedStyle(element).opacity === "1"),
        ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test("an unavailable enhancement script cannot hide the page", async ({ page }) => {
  await page.route("**/assets/js/app.js", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page
      .locator("[data-reveal]")
      .evaluateAll((elements) =>
        elements.every((element) => getComputedStyle(element).opacity === "1"),
      ),
  ).toBe(true);
});

test("print reveals unvisited content, uses a light palette, and preserves résumé URLs", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await home(page, "/?scoutTheme=dark");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".nav")).toBeHidden();
  await expect(page.locator("form")).toBeHidden();
  await expect(page.locator(".doc")).toBeHidden();
  await expect(page.locator(".doc-actions")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("[data-reveal]")
        .evaluateAll((elements) =>
          elements
            .filter((element) => getComputedStyle(element).opacity !== "1")
            .map((element) => element.className),
        ),
    )
    .toEqual([]);
  expect(
    await page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
});

test("missing pages return a real 404 with a usable home link and noindex metadata", async ({
  page,
  request,
}) => {
  const response = await page.goto("/missing-page");
  expect(response.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page wandered off.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.getByRole("link", { name: "Back home" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Akash Ravi");
  expect((await request.post("/")).status()).toBe(405);
  const head = await request.head("/");
  expect(head.status()).toBe(200);
  expect(await head.body()).toHaveLength(0);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("404.html");
  expect((await request.get("/src/data/site.json")).status()).toBe(404);
  expect((await request.get("/package.json")).status()).toBe(404);
});
