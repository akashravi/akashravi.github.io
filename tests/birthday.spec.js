const { test, expect } = require("@playwright/test");

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function openBirthday(page) {
  await page.goto("/for-sathvika/");
  await expect(page.locator("#scratch-card")).toHaveClass(/is-ready/);
  await page.evaluate(() => document.fonts.ready);
}

async function erasedFraction(page) {
  return page.locator("#scratch-canvas").evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let erased = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] < 128) erased++;
    }
    return erased / (data.length / 4);
  });
}

async function scratchRow(page, bounds, y) {
  await page.mouse.move(bounds.x + 12, bounds.y + y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width - 12, bounds.y + y, { steps: 12 });
  await page.mouse.up();
}

test("the birthday page is isolated, spoiler-free, and loads its illustration and font locally", async ({
  page,
  request,
}, testInfo) => {
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await openBirthday(page);
  await expect(page).toHaveTitle("Happy Birthday, Sathvika");
  await expect(page.locator("h1")).toHaveText("Happy Birthday, Sathvika");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://akashravi.github.io/for-sathvika/",
  );
  await expect(page.locator('meta[property="og:description"]')).not.toHaveAttribute(
    "content",
    /Canon|R100/,
  );
  await expect(page.locator("nav, .foot, iframe, form")).toHaveCount(0);
  await expect(page.locator("script")).toHaveCount(1);
  await expect(page.locator("#birthday-prize")).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("heading", { name: /A Canon R100/ })).toHaveCount(0);
  expect(
    await page
      .locator(".bday-couple")
      .evaluate((image) => image.complete && image.naturalWidth > 0),
  ).toBe(true);
  expect(
    await page.evaluate(async () => {
      const fonts = await document.fonts.load('600 32px "Birthday Script"');
      return fonts.length === 1 && fonts[0].status === "loaded";
    }),
  ).toBe(true);
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("for-sathvika");
  expect(await (await request.get("/")).text()).not.toContain("for-sathvika");
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("birthday-mobile.png") });
  await page.screenshot({ path: testInfo.outputPath("birthday-full.png"), fullPage: true });
});

test("the keyboard reveal preserves the surprise, announces the gift, and moves focus", async ({
  page,
}, testInfo) => {
  await openBirthday(page);
  await page.keyboard.press("Tab");
  await expect(page.locator(".bday-skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#birthday-main")).toBeFocused();
  const button = page.getByRole("button", { name: "Or tap to unwrap" });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#scratch-card")).toHaveClass(/is-revealed/);
  await expect(page.locator("#birthday-prize")).toBeFocused();
  await expect(page.getByRole("heading", { name: "A Canon R100, just for you." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/Canon R100.*arrive soon/);
  await expect(page.locator(".bday-delivery")).toContainText(
    "I'm sorry it couldn't be here on your birthday.",
  );
  await expect(button).toBeHidden();
  await expect(page.locator("#birthday-confetti span")).toHaveCount(0);
  await page.locator("#birthday-prize").scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("birthday-revealed.png") });
});

test("scratching actually erases the foil and unwraps only after enough has been removed", async ({
  page,
}) => {
  await openBirthday(page);
  const canvas = page.locator("#scratch-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  expect(await erasedFraction(page)).toBe(0);
  await scratchRow(page, bounds, 30);
  expect(await erasedFraction(page)).toBeGreaterThan(0.03);
  expect(await erasedFraction(page)).toBeLessThan(0.2);
  await expect(page.locator("#scratch-card")).not.toHaveClass(/is-revealed/);
  await expect(page.locator("#scratch-label")).toBeHidden();

  for (let y = 72; y < bounds.height; y += 36) {
    if ((await page.locator("#scratch-card").getAttribute("class")).includes("is-revealed")) break;
    await scratchRow(page, bounds, y);
  }
  await expect(page.locator("#scratch-card")).toHaveClass(/is-revealed/);
  expect(await erasedFraction(page)).toBeGreaterThan(0.44);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
  await expect(page.locator("#birthday-prize")).not.toHaveAttribute("aria-hidden");
});

test("rotation, font reflow, and height-only resizes preserve scratched progress", async ({
  page,
}) => {
  await openBirthday(page);
  const canvas = page.locator("#scratch-canvas");
  await canvas.scrollIntoViewIfNeeded();
  await scratchRow(page, await canvas.boundingBox(), 60);
  const before = await erasedFraction(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect
    .poll(async () => Math.abs((await erasedFraction(page)) - before))
    .toBeLessThan(0.015);
  await page.setViewportSize({ width: 390, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "120%";
  });
  await expect
    .poll(async () => Math.abs((await erasedFraction(page)) - before))
    .toBeLessThan(0.015);
  await page.getByRole("button", { name: "Or tap to unwrap" }).tap();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator("#scratch-card")).toHaveClass(/is-revealed/);
});

test("real mobile touch gestures scratch without scrolling the page", async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Touch dragging uses Chromium's input protocol.");
  await openBirthday(page);
  const canvas = page.locator("#scratch-canvas");
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  const beforeScroll = await page.evaluate(() => scrollY);
  const client = await context.newCDPSession(page);
  for (let row = 30; row < bounds.height; row += 36) {
    if ((await page.locator("#scratch-card").getAttribute("class")).includes("is-revealed")) break;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: bounds.x + 15, y: bounds.y + row }],
    });
    for (let step = 1; step <= 10; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: bounds.x + 15 + ((bounds.width - 30) * step) / 10, y: bounds.y + row }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await expect(page.locator("#scratch-card")).toHaveClass(/is-revealed/);
  expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
  expect(await page.evaluate(() => window.getSelection().toString())).toBe("");
  await client.detach();
});

for (const width of [320, 390, 768, 1440]) {
  test(`the page and unwrapped gift fit without clipping at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openBirthday(page);
    await page.getByRole("button", { name: "Or tap to unwrap" }).tap();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(
      await page.locator("#birthday-prize").evaluate((prize) => {
        const bounds = prize.getBoundingClientRect();
        return (
          prize.scrollHeight <= prize.clientHeight + 1 &&
          [...prize.children].every(
            (child) => child.getBoundingClientRect().bottom <= bounds.bottom,
          )
        );
      }),
    ).toBe(true);
  });
}

test("enlarged text still fits the narrow layout without clipping the gift message", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openBirthday(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.getByRole("button", { name: "Or tap to unwrap" }).tap();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator("#birthday-prize")
      .evaluate((prize) => prize.scrollHeight <= prize.clientHeight + 1),
  ).toBe(true);
});

test("without JavaScript the message and gift are visible without dead controls", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/for-sathvika/");
  await expect(page.getByRole("heading", { name: /A Canon R100/ })).toBeVisible();
  await expect(page.locator("#scratch-canvas")).toBeHidden();
  await expect(page.locator("#reveal-button")).toBeHidden();
  await expect(page.getByText("I can't wait to marry you.", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: /A little surprise is waiting/ }).click();
  await expect(page).toHaveURL(/#birthday-gift$/);
  await context.close();
});

test("an unavailable script or canvas cannot hide the gift", async ({ page }) => {
  await page.route("**/assets/js/birthday.js", (route) => route.abort());
  await page.goto("/for-sathvika/");
  await expect(page.getByRole("heading", { name: /A Canon R100/ })).toBeVisible();
  await expect(page.locator("#reveal-button")).toBeHidden();
  await page.unroute("**/assets/js/birthday.js");
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning") warnings.push(message.text());
  });
  await page.reload();
  await expect(page.locator("#gift-hint")).toHaveText(
    "No scratching needed. Your surprise is already unwrapped.",
  );
  await expect(page.getByRole("heading", { name: /A Canon R100/ })).toBeVisible();
  await expect(page.locator("#reveal-button")).toBeHidden();
  expect(warnings).toContain(
    "Scratch card canvas is unavailable; showing the gift without scratching.",
  );
});

test("celebration respects motion changes and the birthday theme ignores portfolio preferences", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  await openBirthday(page);
  const background = await page
    .locator("body")
    .evaluate((body) => getComputedStyle(body).background);
  await page.getByRole("button", { name: "Or tap to unwrap" }).tap();
  await expect(page.locator("#birthday-confetti span")).toHaveCount(24);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await expect(page.locator("#birthday-confetti span")).toHaveCount(0);
  expect(await page.locator("body").evaluate((body) => getComputedStyle(body).background)).toBe(
    background,
  );
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
});
