import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBrowser, supportedBrowsers } from "./browsers/registry.js";
import { BridgeUnavailableError, sendBridgeCommandWithRetry } from "./bridge/client.js";
import { getConfiguredBrowser, readConfig, setConfiguredBrowser } from "./util/config.js";
import { screenshotsDir } from "./util/paths.js";

export async function runCli(argv) {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const parsed = parseGlobalOptions(argv);
  const [command, ...positionals] = parsed.positionals;

  if (command === "config") {
    runConfigCommand(positionals);
    return;
  }

  if (command === "install") {
    const target = positionals[0];
    if (target === "skill" || target === "skills") {
      const result = installBrowserSkill(parsed.flags.get("to"));
      console.error(result.note);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const browserName = target || parsed.browser || getConfiguredBrowser();
    if (!browserName) throw new Error(`Usage: OpenBrowser install <browser>`);
    const installAdapter = resolveBrowser(browserName);
    const result = await installAdapter.install();
    console.error(result.note);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const adapter = resolveBrowser(parsed.browser || getConfiguredBrowser());
  const request = toBridgeRequest(command, positionals, parsed.flags);
  if (!request) throw new Error(`Unknown command: ${command}`);

  const result = await sendCommandEnsuringBridge(adapter, request.command, request.args, request.timeoutMs);
  await printResult(request, result);
}

function runConfigCommand(args) {
  const [key, value] = args;

  if (!key) {
    console.log(JSON.stringify(readConfig(), null, 2));
    return;
  }

  if (key !== "browser") {
    throw new Error(`Unknown config key: ${key}. Supported keys: browser.`);
  }

  if (value === undefined) {
    console.log(JSON.stringify({ browser: getConfiguredBrowser() ?? null }, null, 2));
    return;
  }

  const name = value.toLowerCase();
  resolveBrowser(name); // Validates against supported browsers before persisting.
  const config = setConfiguredBrowser(name);
  console.error(`Default browser set to ${name}.`);
  console.log(JSON.stringify(config, null, 2));
}

async function sendCommandEnsuringBridge(adapter, command, args, timeoutMs) {
  try {
    return await sendBridgeCommandWithRetry(adapter.name, command, args, { timeoutMs });
  } catch (error) {
    if (!(error instanceof BridgeUnavailableError)) throw error;
    await adapter.launch();
    return sendBridgeCommandWithRetry(adapter.name, command, args, {
      timeoutMs,
      attempts: 12,
      delayMs: 500,
    });
  }
}

function parseGlobalOptions(argv) {
  const flags = new Map();
  const positionals = [];
  let browser;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--browser") {
      browser = requireValue(argv, ++i, "--browser");
      continue;
    }
    if (token.startsWith("--browser=")) {
      browser = token.slice("--browser=".length);
      continue;
    }
    if (token.startsWith("--")) {
      const [name, inlineValue] = token.slice(2).split("=", 2);
      if (inlineValue !== undefined) flags.set(name, inlineValue);
      else if (isValueFlag(name)) flags.set(name, requireValue(argv, ++i, `--${name}`));
      else flags.set(name, true);
      continue;
    }
    positionals.push(token);
  }

  return { browser, flags, positionals };
}

function isValueFlag(name) {
  return new Set(["ref", "to"]).has(name);
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}.`);
  return value;
}

function toBridgeRequest(command, args, flags) {
  switch (command) {
    case "open":
      return requireArgs(command, args, 1, { command, args: { url: args[0] } });
    case "close":
    case "status":
    case "reload":
    case "back":
    case "forward":
    case "state":
      return { command, args: {} };
    case "navigate":
      return requireArgs(command, args, 1, { command, args: { url: args[0] } });
    case "screenshot":
      return { command, args: { base64: Boolean(flags.get("base64")) }, timeoutMs: 45_000 };
    case "click":
      return requireArgs(command, args, 1, { command, args: { ref: args[0] } });
    case "keys":
      return requireArgs(command, args, 1, { command, args: { text: args.join(" ") } });
    case "press":
      return requireArgs(command, args, 1, { command, args: { key: args[0] } });
    case "select":
      return requireArgs(command, args, 2, { command, args: { ref: args[0], option: args[1] } });
    case "get":
      if (!flags.get("html")) throw new Error("Only get --html is currently supported.");
      return { command: "getHtml", args: { ref: flags.get("ref") || null } };
    case "scroll":
      if (flags.get("to")) return { command, args: { to: flags.get("to") } };
      if (!["up", "down"].includes(args[0])) {
        throw new Error("Usage: OpenBrowser scroll up|down [pixels] or OpenBrowser scroll --to <ref>");
      }
      return { command, args: { direction: args[0], pixels: Number(args[1] || 600) } };
    default:
      return null;
  }
}

function requireArgs(name, args, count, request) {
  if (args.length < count) throw new Error(`Missing argument for ${name}.`);
  return request;
}

function installBrowserSkill(to) {
  if (!to) throw new Error("Usage: OpenBrowser install skills --to <agent-dir-or-skills-dir>");

  const requested = path.resolve(to);
  const skillsDir = path.basename(requested) === "skills" ? requested : path.join(requested, "skills");
  const destination = path.join(skillsDir, "browser");
  const source = fileURLToPath(new URL("../skills/browser/SKILL.md", import.meta.url));

  fs.mkdirSync(destination, { recursive: true });
  fs.copyFileSync(source, path.join(destination, "SKILL.md"));

  return {
    skill: "browser",
    destination,
    files: [path.join(destination, "SKILL.md")],
    note: `Installed browser skill to ${destination}.`,
  };
}

async function printResult(request, result) {
  if (request.command === "screenshot") {
    const base64 = normalizeBase64(result.dataUrl || result.base64 || "");
    if (request.args.base64) {
      process.stdout.write(`${base64}\n`);
      return;
    }

    const dir = screenshotsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${crypto.randomBytes(4).toString("hex")}.png`);
    fs.writeFileSync(file, Buffer.from(base64, "base64"));
    process.stdout.write(`${file}\n`);
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

function normalizeBase64(value) {
  const comma = value.indexOf(",");
  return comma === -1 ? value : value.slice(comma + 1);
}

function printHelp() {
  console.log(`OpenBrowser\n\nUsage:\n  OpenBrowser install <browser>\n  OpenBrowser install skills --to <agent-dir-or-skills-dir>\n  OpenBrowser config browser <browser>\n  OpenBrowser open <url> [--browser <browser>]\n  OpenBrowser close [--browser <browser>]\n  OpenBrowser status [--browser <browser>]\n  OpenBrowser navigate <url> [--browser <browser>]\n  OpenBrowser reload|back|forward [--browser <browser>]\n  OpenBrowser state [--browser <browser>]\n  OpenBrowser screenshot [--base64] [--browser <browser>]\n  OpenBrowser click <ref> [--browser <browser>]\n  OpenBrowser keys <text> [--browser <browser>]\n  OpenBrowser press <key> [--browser <browser>]\n  OpenBrowser select <ref> <option> [--browser <browser>]\n  OpenBrowser get --html [--ref <ref>] [--browser <browser>]\n  OpenBrowser scroll up|down [pixels] [--browser <browser>]\n  OpenBrowser scroll --to <ref> [--browser <browser>]\n\nSupported browsers: ${supportedBrowsers().join(", ")}\nSet a default browser with: OpenBrowser config browser <browser>`);
}
