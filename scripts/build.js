#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import yazl from "yazl";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || "firefox";

const sourceDir = path.join(root, "extensions");

if (target === "firefox") {
  await buildFirefox();
} else if (target === "chromium") {
  await buildChromium();
} else {
  throw new Error(`Unsupported build target: ${target}`);
}

async function buildFirefox() {
  const buildDir = path.join(root, "build", "firefox-extension");
  const outDir = path.join(root, "dist", "extensions", "firefox");
  const outFile = path.join(outDir, "openbrowser-dev.xpi");

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  copyFile(path.join(sourceDir, "manifest.json"), path.join(buildDir, "manifest.json"));
  copyExtensionCode(buildDir);

  await zipDirectory(buildDir, outFile);
  console.log(`Built ${path.relative(root, outFile)}`);
}

async function buildChromium() {
  const outDir = path.join(root, "dist", "extensions", "chromium");
  const unpackedDir = path.join(outDir, "unpacked");
  const outFile = path.join(outDir, "openbrowser.zip");

  fs.rmSync(unpackedDir, { recursive: true, force: true });
  fs.mkdirSync(unpackedDir, { recursive: true });

  fs.writeFileSync(path.join(unpackedDir, "manifest.json"), `${JSON.stringify(chromiumManifest(), null, 2)}\n`);
  copyExtensionCode(unpackedDir);

  fs.rmSync(outFile, { force: true });
  await zipDirectory(unpackedDir, outFile);
  console.log(`Built ${path.relative(root, unpackedDir)}`);
  console.log(`Built ${path.relative(root, outFile)}`);
}

// Transforms the shared MV2 manifest into an MV3 manifest for Chromium. The two
// extension scripts are feature-detected so the same code runs on both families.
function chromiumManifest() {
  const source = JSON.parse(fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"));
  const hostPermissions = (source.permissions || []).filter((permission) => permission.includes("://") || permission === "<all_urls>");
  const permissions = (source.permissions || []).filter((permission) => !hostPermissions.includes(permission));

  return {
    manifest_version: 3,
    name: source.name,
    version: source.version,
    description: source.description,
    key: readChromeKey(),
    minimum_chrome_version: "109",
    permissions: [...new Set([...permissions, "scripting"])],
    host_permissions: hostPermissions,
    background: {
      service_worker: "background.js",
    },
  };
}

function readChromeKey() {
  const constants = fs.readFileSync(path.join(root, "src", "constants.js"), "utf8");
  const match = constants.match(/CHROME_EXTENSION_KEY\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("Could not read CHROME_EXTENSION_KEY from src/constants.js.");
  return match[1];
}

function copyExtensionCode(destinationDir) {
  copyFile(path.join(sourceDir, "background.js"), path.join(destinationDir, "background.js"));
  copyFile(path.join(sourceDir, "content.js"), path.join(destinationDir, "content.js"));
  copyDirectory(path.join(sourceDir, "assets"), path.join(destinationDir, "assets"));
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirectory(from, to) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const destination = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(source, destination);
    else copyFile(source, destination);
  }
}

function zipDirectory(directory, destination) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const output = fs.createWriteStream(destination);

    output.on("close", resolve);
    output.on("error", reject);
    zip.outputStream.on("error", reject);
    zip.outputStream.pipe(output);

    for (const file of listFiles(directory)) {
      zip.addFile(file, path.relative(directory, file).replace(/\\/g, "/"));
    }
    zip.end();
  });
}

function listFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...listFiles(full));
    else result.push(full);
  }
  return result;
}
