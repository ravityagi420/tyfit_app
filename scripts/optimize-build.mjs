import { promises as fs } from "node:fs";
import path from "node:path";
import { minify } from "html-minifier-terser";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");

const SKIP_DIRS = new Set(["node_modules", ".git", "dist"]);
const SKIP_FILES = new Set(["package-lock.json"]);

const htmlOptions = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: false,
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function emptyDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

async function copyAndOptimize(srcDir, outDir) {
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const outPath = path.join(outDir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await ensureDir(outPath);
      await copyAndOptimize(srcPath, outPath);
      continue;
    }

    if (SKIP_FILES.has(entry.name)) continue;

    if (entry.name.toLowerCase().endsWith(".html")) {
      const html = await fs.readFile(srcPath, "utf8");
      const optimized = await minify(html, htmlOptions);
      await fs.writeFile(outPath, optimized, "utf8");
      continue;
    }

    await fs.copyFile(srcPath, outPath);
  }
}

async function main() {
  await emptyDir(distDir);
  await copyAndOptimize(projectRoot, distDir);
  console.log("Build complete: dist/ generated with optimized HTML.");
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
