import os from "node:os";
import path from "node:path";
import { FirefoxFamilyAdapter } from "./firefox-family.js";

function platformProfileRoots() {
  if (process.platform === "darwin") {
    return [
      "~/Library/Application Support/zen",
      "~/Library/Application Support/Zen",
      "~/Library/Application Support/Zen Browser",
    ];
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return [path.join(appData, "zen"), path.join(appData, "Zen"), path.join(appData, "Zen Browser")];
  }

  return ["~/.zen", "~/.zen-browser", "~/.mozilla/zen"];
}

function platformNativeManifestRoots() {
  if (process.platform === "darwin") {
    return [
      "~/Library/Application Support/Mozilla",
      "~/Library/Application Support/zen",
      "~/Library/Application Support/Zen",
      "~/Library/Application Support/Zen Browser",
    ];
  }

  if (process.platform === "win32") {
    return [];
  }

  return ["~/.mozilla", "~/.zen", "~/.zen-browser"];
}

function platformProcessNames() {
  if (process.platform === "darwin") return ["Zen Browser", "Zen", "zen"];
  if (process.platform === "win32") return ["zen", "zen-browser"];
  return ["zen", "zen-bin", "zen-browser"];
}

function platformLaunchCommands() {
  if (process.platform === "darwin") {
    return [
      { command: "open", args: ["-a", "Zen Browser"] },
      { command: "open", args: ["-a", "Zen"] },
    ];
  }

  if (process.platform === "win32") {
    return [
      { command: "cmd", args: ["/c", "start", "", "zen"] },
      { command: "cmd", args: ["/c", "start", "", "zen-browser"] },
    ];
  }

  return [
    { command: "zen-browser", args: [] },
    { command: "zen", args: [] },
  ];
}

export class ZenBrowserAdapter extends FirefoxFamilyAdapter {
  constructor() {
    super({
      name: "zen",
      displayName: "Zen",
      profileRoots: platformProfileRoots(),
      nativeManifestRoots: platformNativeManifestRoots(),
      launchCommands: platformLaunchCommands(),
      processNames: platformProcessNames(),
    });
  }
}
