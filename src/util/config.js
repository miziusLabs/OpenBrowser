import fs from "node:fs";
import path from "node:path";
import { openBrowserHome } from "./paths.js";

export function configPath() {
  return path.join(openBrowserHome(), "config.json");
}

export function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath(), "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeConfig(config) {
  const file = configPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function getConfiguredBrowser() {
  const value = readConfig().browser;
  return typeof value === "string" && value ? value : undefined;
}

export function setConfiguredBrowser(browser) {
  const config = readConfig();
  config.browser = browser;
  return writeConfig(config);
}
