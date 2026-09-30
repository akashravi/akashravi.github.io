import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../assets/js/analytics.js", import.meta.url), "utf8");

function bootstrap({ hostname = "akashravi.github.io", navigator = {}, idle = true } = {}) {
  const listeners = {};
  const scripts = [];
  const window = {
    location: { hostname },
    addEventListener: (name, callback) => (listeners[name] = callback),
    setTimeout: (callback) => callback(),
  };
  if (idle) window.requestIdleCallback = (callback) => callback();
  const document = {
    createElement: () => ({}),
    head: { appendChild: (script) => scripts.push(script) },
  };
  vm.runInNewContext(source, { window, navigator, document, Date });
  return { window, listeners, scripts };
}

for (const options of [
  { hostname: "localhost" },
  { hostname: "127.0.0.1" },
  { navigator: { globalPrivacyControl: true } },
  { navigator: { doNotTrack: "1" } },
]) {
  test(`analytics respects local preview or privacy opt-out: ${JSON.stringify(options)}`, () => {
    const result = bootstrap(options);
    assert.equal(result.window.dataLayer, undefined);
    assert.deepEqual(result.listeners, {});
    assert.deepEqual(result.scripts, []);
  });
}

for (const idle of [true, false]) {
  test(`analytics loads once after interaction, with ${idle ? "idle" : "timer"} scheduling`, () => {
    const result = bootstrap({ idle });
    assert.equal(result.scripts.length, 0);
    assert.equal(result.window.dataLayer[0][2].analytics_storage, "denied");
    result.listeners.pointerdown();
    result.listeners.keydown();
    assert.equal(result.scripts.length, 1);
    assert.equal(result.scripts[0].async, true);
    assert.equal(result.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-4RRVMZ97X0");
  });
}
