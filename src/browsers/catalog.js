import os from "node:os";
import path from "node:path";

function homePath(...segments) {
  return path.join(os.homedir(), ...segments);
}

function envPath(name, fallback) {
  return process.env[name] || fallback;
}

function macApplicationPaths(names) {
  return names.flatMap((name) => [
    path.join("/Applications", `${name}.app`),
    homePath("Applications", `${name}.app`),
  ]);
}

function windowsApplicationPaths(...segments) {
  const localAppData = envPath("LOCALAPPDATA", path.join(os.homedir(), "AppData", "Local"));
  const programFiles = envPath("ProgramFiles", "C:\\Program Files");
  const programFilesX86 = envPath("ProgramFiles(x86)", "C:\\Program Files (x86)");

  return [
    path.join(localAppData, ...segments),
    path.join(programFiles, ...segments),
    path.join(programFilesX86, ...segments),
  ];
}

function zenDefinition() {
  if (process.platform === "darwin") {
    return {
      name: "zen",
      aliases: ["zen-browser", "zen browser"],
      displayName: "Zen",
      family: "firefox",
      profileRoots: [
        homePath("Library", "Application Support", "zen"),
        homePath("Library", "Application Support", "Zen"),
        homePath("Library", "Application Support", "Zen Browser"),
      ],
      nativeManifestRoots: [
        homePath("Library", "Application Support", "Mozilla"),
        homePath("Library", "Application Support", "zen"),
        homePath("Library", "Application Support", "Zen"),
        homePath("Library", "Application Support", "Zen Browser"),
      ],
      applicationPaths: macApplicationPaths(["Zen Browser", "Zen"]),
      executableCandidates: ["zen", "zen-browser"],
      processNames: ["Zen Browser", "Zen", "zen"],
      launchCommands: [
        { command: "open", args: ["-a", "Zen Browser"] },
        { command: "open", args: ["-a", "Zen"] },
      ],
    };
  }

  if (process.platform === "win32") {
    const appData = envPath("APPDATA", path.join(os.homedir(), "AppData", "Roaming"));

    return {
      name: "zen",
      aliases: ["zen-browser", "zen browser"],
      displayName: "Zen",
      family: "firefox",
      profileRoots: [
        path.join(appData, "zen"),
        path.join(appData, "Zen"),
        path.join(appData, "Zen Browser"),
      ],
      nativeManifestRoots: [],
      applicationPaths: windowsApplicationPaths("Zen Browser", "zen.exe"),
      executableCandidates: ["zen.exe", "zen-browser.exe"],
      processNames: ["zen.exe", "zen-browser.exe"],
      launchCommands: [
        { command: "cmd", args: ["/c", "start", "", "zen"] },
        { command: "cmd", args: ["/c", "start", "", "zen-browser"] },
      ],
    };
  }

  return {
    name: "zen",
    aliases: ["zen-browser", "zen browser"],
    displayName: "Zen",
    family: "firefox",
    profileRoots: [homePath(".zen"), homePath(".zen-browser"), homePath(".mozilla", "zen")],
    nativeManifestRoots: [homePath(".mozilla"), homePath(".zen"), homePath(".zen-browser")],
    applicationPaths: ["/usr/bin/zen", "/usr/bin/zen-browser", homePath(".local", "bin", "zen")],
    executableCandidates: ["zen", "zen-bin", "zen-browser"],
    processNames: ["zen", "zen-bin", "zen-browser"],
    launchCommands: [
      { command: "zen-browser", args: [] },
      { command: "zen", args: [] },
    ],
  };
}

function chromeDefinition() {
  if (process.platform === "darwin") {
    const profileRoot = homePath("Library", "Application Support", "Google", "Chrome");
    return {
      name: "chrome",
      aliases: ["google-chrome", "google chrome"],
      displayName: "Chrome",
      family: "chromium",
      profileRoots: [profileRoot],
      nativeManifestRoots: [profileRoot],
      applicationPaths: macApplicationPaths(["Google Chrome"]),
      executableCandidates: ["google-chrome", "google-chrome-stable"],
      launchCommands: [{ command: "open", args: ["-a", "Google Chrome"] }],
    };
  }

  if (process.platform === "win32") {
    const localAppData = envPath("LOCALAPPDATA", path.join(os.homedir(), "AppData", "Local"));
    return {
      name: "chrome",
      aliases: ["google-chrome", "google chrome"],
      displayName: "Chrome",
      family: "chromium",
      profileRoots: [path.join(localAppData, "Google", "Chrome", "User Data")],
      nativeManifestRoots: [],
      applicationPaths: windowsApplicationPaths("Google", "Chrome", "Application", "chrome.exe"),
      executableCandidates: ["chrome.exe", "google-chrome.exe"],
      launchCommands: [{ command: "cmd", args: ["/c", "start", "", "chrome"] }],
    };
  }

  return {
    name: "chrome",
    aliases: ["google-chrome", "google chrome"],
    displayName: "Chrome",
    family: "chromium",
    profileRoots: [homePath(".config", "google-chrome")],
    nativeManifestRoots: [homePath(".config", "google-chrome")],
    applicationPaths: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable"],
    executableCandidates: ["google-chrome", "google-chrome-stable"],
    launchCommands: [
      { command: "google-chrome", args: [] },
      { command: "google-chrome-stable", args: [] },
    ],
  };
}

function heliumDefinition() {
  if (process.platform === "darwin") {
    const profileRoot = homePath("Library", "Application Support", "net.imput.helium");
    return {
      name: "helium",
      aliases: ["helium-browser", "helium browser"],
      displayName: "Helium",
      family: "chromium",
      profileRoots: [
        profileRoot,
        homePath("Library", "Application Support", "Helium"),
        homePath("Library", "Application Support", "Helium Browser"),
      ],
      nativeManifestRoots: [
        profileRoot,
        homePath("Library", "Application Support", "Helium"),
        homePath("Library", "Application Support", "Helium Browser"),
      ],
      applicationPaths: macApplicationPaths(["Helium", "Helium Browser"]),
      executableCandidates: ["helium", "helium-browser"],
      launchCommands: [
        { command: "open", args: ["-a", "Helium"] },
        { command: "open", args: ["-a", "Helium Browser"] },
      ],
    };
  }

  if (process.platform === "win32") {
    const appData = envPath("APPDATA", path.join(os.homedir(), "AppData", "Roaming"));
    const localAppData = envPath("LOCALAPPDATA", path.join(os.homedir(), "AppData", "Local"));
    return {
      name: "helium",
      aliases: ["helium-browser", "helium browser"],
      displayName: "Helium",
      family: "chromium",
      profileRoots: [
        path.join(localAppData, "Helium", "User Data"),
        path.join(appData, "Helium"),
      ],
      nativeManifestRoots: [],
      applicationPaths: [
        ...windowsApplicationPaths("Helium", "helium.exe"),
        ...windowsApplicationPaths("Helium Browser", "helium.exe"),
      ],
      executableCandidates: ["helium.exe", "helium-browser.exe"],
      launchCommands: [
        { command: "cmd", args: ["/c", "start", "", "helium"] },
        { command: "cmd", args: ["/c", "start", "", "helium-browser"] },
      ],
    };
  }

  return {
    name: "helium",
    aliases: ["helium-browser", "helium browser"],
    displayName: "Helium",
    family: "chromium",
    profileRoots: [homePath(".config", "helium"), homePath(".config", "helium-browser")],
    nativeManifestRoots: [homePath(".config", "helium"), homePath(".config", "helium-browser")],
    applicationPaths: ["/usr/bin/helium", "/usr/bin/helium-browser", homePath(".local", "bin", "helium")],
    executableCandidates: ["helium", "helium-browser"],
    launchCommands: [
      { command: "helium", args: [] },
      { command: "helium-browser", args: [] },
    ],
  };
}

export function browserDefinitions() {
  return [zenDefinition(), chromeDefinition(), heliumDefinition()];
}

export function getBrowserDefinition(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return browserDefinitions().find((definition) => (
    definition.name === normalized || definition.aliases.includes(normalized)
  ));
}
