import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ROOT } from "../../scripts/build.mjs";

export async function createBuildFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-build-"));
  try {
    await Promise.all(
      ["src", "assets", "images", "favicon.ico"].map((file) =>
        cp(path.join(ROOT, file), path.join(root, file), { recursive: true }),
      ),
    );
    const sitePath = path.join(root, "src", "data", "site.json");
    const projectsPath = path.join(root, "src", "data", "projects.json");
    const site = JSON.parse(await readFile(sitePath, "utf8"));
    const projects = JSON.parse(await readFile(projectsPath, "utf8"));
    return {
      root,
      site,
      projects,
      save: () => writeFile(sitePath, JSON.stringify(site)),
      saveProjects: () => writeFile(projectsPath, JSON.stringify(projects)),
      output: (file) => readFile(path.join(root, "dist", file), "utf8"),
      cleanup: () => rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}
