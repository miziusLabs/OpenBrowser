#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = path.join(root, "package.json");
const manifestPath = path.join(root, "extensions", "manifest.json");
const readmePath = path.join(root, "README.md");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;

if (!version) throw new Error("package.json is missing a version.");

let changed = false;

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.version !== version) {
  manifest.version = version;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated extensions/manifest.json version to ${version}`);
  changed = true;
}

const readme = fs.readFileSync(readmePath, "utf8");
const escapedVersion = version.replace(/-/g, "--").replace(/_/g, "__");
const updatedReadme = readme.replace(
  /https:\/\/img\.shields\.io\/badge\/version-[^-\s"]+-blue\?style=flat-square/g,
  `https://img.shields.io/badge/version-${escapedVersion}-blue?style=flat-square`,
);

if (updatedReadme !== readme) {
  fs.writeFileSync(readmePath, updatedReadme);
  console.log(`Updated README.md version badge to ${version}`);
  changed = true;
}

if (!changed) console.log(`Version metadata already matches ${version}`);
