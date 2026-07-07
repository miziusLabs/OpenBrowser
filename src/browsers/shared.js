import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openBrowserHome } from "../util/paths.js";

// Installs the shared, browser-agnostic native messaging host launcher used by
// every OpenBrowser adapter and returns the path to the per-browser launcher.
export function installNativeHost(browser) {
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../native-host.cjs");
  const dir = path.join(openBrowserHome(), "native-host");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const hostScript = path.join(dir, "openbrowser-native-host.cjs");
  fs.copyFileSync(source, hostScript);
  if (process.platform !== "win32") fs.chmodSync(hostScript, 0o755);

  if (process.platform === "win32") {
    const cmd = path.join(dir, `openbrowser-native-host-${browser}.cmd`);
    fs.writeFileSync(cmd, `@echo off\r\nset OPENBROWSER_BROWSER=${browser}\r\n"${process.execPath}" "${hostScript}"\r\n`, "utf8");
    return cmd;
  }

  const launcher = path.join(dir, `openbrowser-native-host-${browser}`);
  fs.writeFileSync(launcher, `#!/bin/sh\nOPENBROWSER_BROWSER=${shellQuote(browser)} exec ${shellQuote(process.execPath)} ${shellQuote(hostScript)}\n`, "utf8");
  fs.chmodSync(launcher, 0o755);
  return launcher;
}

export function findRunningProcess(processNames) {
  if (processNames.length === 0) return null;

  if (process.platform === "win32") return findRunningWindowsProcess(processNames);
  return findRunningUnixProcess(processNames);
}

function findRunningUnixProcess(processNames) {
  for (const processName of processNames) {
    try {
      execFileSync("pgrep", ["-x", processName], { stdio: "ignore" });
      return processName;
    } catch {
      // Process is not running, or pgrep is unavailable. Try the next known name.
    }
  }
  return null;
}

function findRunningWindowsProcess(processNames) {
  let output;
  try {
    output = execFileSync("tasklist", ["/fo", "csv", "/nh"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }

  const runningNames = new Set(output
    .split(/\r?\n/)
    .map((line) => parseTasklistImageName(line))
    .filter(Boolean)
    .map((name) => name.toLowerCase()));

  for (const processName of processNames) {
    const executable = processName.toLowerCase().endsWith(".exe") ? processName.toLowerCase() : `${processName.toLowerCase()}.exe`;
    if (runningNames.has(executable)) return processName;
  }
  return null;
}

function parseTasklistImageName(line) {
  const match = line.match(/^"((?:[^"]|"")*)"/);
  if (!match) return null;
  return match[1].replace(/""/g, "\"");
}

export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function expandHome(value) {
  if (!value.startsWith("~")) return value;
  return path.join(os.homedir(), value.slice(2));
}

export function uniqueExistingDirectories(paths) {
  const seen = new Set();
  const result = [];
  for (const candidate of paths) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) continue;
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) continue;
    seen.add(resolved);
    result.push(resolved);
  }
  return result;
}
