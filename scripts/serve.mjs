import { watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { build, OUTPUT, ROOT } from "./build.mjs";

const port = Number(process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
await build();
let pendingBuild = Promise.resolve();
let buildError = null;
const handleRequest = async (request, response) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method not allowed");
    return;
  }
  await pendingBuild;
  if (buildError) {
    response.writeHead(500, { "Content-Type": types[".txt"] });
    response.end("Build failed. See the terminal for details.");
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch (error) {
    console.error("Invalid request URL:", error.message);
    response.writeHead(400);
    response.end("Invalid request URL");
    return;
  }
  let file = path.resolve(OUTPUT, `.${pathname}`);
  const relative = path.relative(OUTPUT, file);
  if (relative.startsWith("..") || path.isAbsolute(relative) || pathname.includes("\0")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  let status = 200;
  let content;
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith("/")) {
        response.writeHead(301, { Location: `${pathname}/` });
        response.end();
        return;
      }
      file = path.join(file, "index.html");
    }
    content = await readFile(file);
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
      console.error(`Unable to serve ${pathname}:`, error);
      response.writeHead(500);
      response.end("Unable to read this file. See the terminal for details.");
      return;
    }
    status = 404;
    file = path.join(OUTPUT, "404.html");
    content = await readFile(file);
  }
  if (path.extname(file) === ".html") {
    // Safari upgrades localhost HTTP too; production files keep the original strict CSP.
    content = Buffer.from(content.toString("utf8").replace("; upgrade-insecure-requests", ""));
  }
  response.writeHead(status, {
    "Content-Type": types[path.extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : content);
};
const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Unable to serve request:", error);
    if (!response.headersSent) response.writeHead(500, { "Content-Type": types[".txt"] });
    response.end("Unable to serve this request. See the terminal for details.");
  });
});
server.listen(port, "127.0.0.1", () => console.log(`Portfolio: http://127.0.0.1:${port}`));

let watcher;
let debounce;
if (process.argv.includes("--watch")) {
  watcher = watch(ROOT, { recursive: true }, (_, filename) => {
    if (!filename || (!/^(src|assets|images)[\\/]/.test(filename) && filename !== "favicon.ico")) {
      return;
    }
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      pendingBuild = pendingBuild.then(async () => {
        try {
          await build();
          buildError = null;
          console.log("Rebuilt. Refresh the browser to see changes.");
        } catch (error) {
          buildError = error;
          console.error("Build failed:", error);
        }
      });
    }, 100);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    clearTimeout(debounce);
    watcher?.close();
    server.close(() => process.exit(0));
  });
}
