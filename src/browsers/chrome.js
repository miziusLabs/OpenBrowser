import os from "node:os";
import path from "node:path";
import { ChromiumFamilyAdapter } from "./chromium-family.js";

function platformNativeManifestRoots() {
  if (process.platform === "darwin") {
    return ["~/Library/Application Support/Google/Chrome"];
  }

  if (process.platform === "win32") {
    return [];
  }

  return ["~/.config/google-chrome"];
}

function platformRegistryRoots() {
  if (process.platform !== "win32") return [];
  return ["HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts"];
}

function platformLaunchCommands() {
  if (process.platform === "darwin") {
    return [{ command: "open", args: ["-a", "Google Chrome"] }];
  }

  if (process.platform === "win32") {
    return [{ command: "cmd", args: ["/c", "start", "", "chrome"] }];
  }

  return [
    { command: "google-chrome", args: [] },
    { command: "google-chrome-stable", args: [] },
  ];
}

export class ChromeBrowserAdapter extends ChromiumFamilyAdapter {
  constructor() {
    super({
      name: "chrome",
      displayName: "Chrome",
      nativeManifestRoots: platformNativeManifestRoots(),
      registryRoots: platformRegistryRoots(),
      launchCommands: platformLaunchCommands(),
    });
  }
}
