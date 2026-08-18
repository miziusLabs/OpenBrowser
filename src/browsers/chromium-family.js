import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { CHROMIUM_EXTENSION_ID, CHROMIUM_UNPACKED_DIR, NATIVE_HOST_NAME } from "../constants.js";
import { bridgeSocketPath, openBrowserHome, packageRoot } from "../util/paths.js";
import {
  availableCommands,
  existingPaths,
  expandHome,
  installNativeHost,
  launchBrowser,
  nativeHostLauncherPath,
  nativeMessagingManifestPath,
  nativeMessagingManifestPaths,
  uniqueExistingDirectories,
} from "./shared.js";

export class ChromiumFamilyAdapter {
  constructor(options) {
    this.name = options.name;
    this.displayName = options.displayName;
    this.family = options.family || "chromium";
    this.aliases = options.aliases || [];
    this.profileRoots = options.profileRoots || [];
    this.nativeManifestRoots = options.nativeManifestRoots || [];
    this.launchCommands = options.launchCommands || [];
    this.applicationPaths = options.applicationPaths || [];
    this.executableCandidates = options.executableCandidates || [];
    this.registryRoots = options.registryRoots || [];
  }

  artifactPath() {
    return path.join(packageRoot(), CHROMIUM_UNPACKED_DIR);
  }

  detect() {
    const profiles = uniqueExistingDirectories(this.profileRoots.map((root) => expandHome(root)));
    const applications = existingPaths(this.applicationPaths);
    const executables = availableCommands(this.executableCandidates);
    const nativeManifests = existingPaths(this.nativeManifestCandidates());
    const extension = path.join(openBrowserHome(), "extensions", this.name);
    const stagedExtension = fs.existsSync(path.join(extension, "manifest.json"));
    const nativeHost = fs.existsSync(nativeHostLauncherPath(this.name));
    const bridgeSocket = fs.existsSync(bridgeSocketPath(this.name));
    const installed = profiles.length > 0 || applications.length > 0 || executables.length > 0;
    const configured = stagedExtension && nativeHost && (nativeManifests.length > 0 || process.platform === "win32");

    return {
      browser: this.name,
      displayName: this.displayName,
      family: this.family,
      aliases: this.aliases,
      installed,
      configured,
      detected: installed || configured || nativeHost || bridgeSocket,
      ready: false,
      sessionOpen: false,
      profiles,
      applications,
      executables,
      extension: stagedExtension ? extension : null,
      nativeManifests,
      nativeHost,
      bridgeSocket,
    };
  }

  async install() {
    const source = this.artifactPath();
    if (!fs.existsSync(source)) {
      throw new Error(`Missing Chromium extension artifact: ${source}. Run npm run build:chromium first.`);
    }

    const nativeHost = installNativeHost(this.name);
    const manifests = installNativeMessagingManifests(this.name, this.nativeManifestRoots, this.registryRoots, nativeHost);

    // Chromium browsers cannot side-load a packed extension from the profile the
    // way Firefox does, so stage the unpacked extension and let the user load it.
    const unpackedDir = path.join(openBrowserHome(), "extensions", this.name);
    fs.rmSync(unpackedDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(unpackedDir), { recursive: true });
    fs.cpSync(source, unpackedDir, { recursive: true });

    return {
      browser: this.name,
      unpackedExtension: unpackedDir,
      extensionId: CHROMIUM_EXTENSION_ID,
      nativeHost,
      nativeManifests: manifests,
      note: `Load the OpenBrowser extension in ${this.displayName}: open the extensions page, enable Developer mode, choose "Load unpacked", and select ${unpackedDir}.`,
    };
  }

  async launch() {
    return launchBrowser(this.launchCommands);
  }

  nativeManifestCandidates() {
    const candidates = nativeMessagingManifestPaths(this.nativeManifestRoots, "NativeMessagingHosts");
    if (process.platform === "win32") {
      candidates.push(nativeMessagingManifestPath(this.name));
    }
    return candidates;
  }
}

function installNativeMessagingManifests(browser, roots, registryRoots, hostPath) {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: "OpenBrowser local user-scoped native bridge",
    path: hostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${CHROMIUM_EXTENSION_ID}/`],
  };

  const written = [];
  for (const root of roots.map((entry) => expandHome(entry))) {
    const dir = path.join(root, "NativeMessagingHosts");
    try {
      fs.mkdirSync(dir, { recursive: true });
      const target = path.join(dir, `${NATIVE_HOST_NAME}.json`);
      fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      written.push(target);
    } catch {
      // Some candidate vendor directories may not be writable or useful on this platform.
    }
  }

  if (process.platform === "win32") {
    const manifestDir = path.join(openBrowserHome(), "native-messaging-hosts");
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = nativeMessagingManifestPath(browser);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    written.push(manifestPath);

    for (const registryRoot of registryRoots) {
      try {
        spawn("reg", [
          "add",
          `${registryRoot}\\${NATIVE_HOST_NAME}`,
          "/ve",
          "/t",
          "REG_SZ",
          "/d",
          manifestPath,
          "/f",
        ], { stdio: "ignore" });
      } catch {}
    }
  }

  return written;
}
