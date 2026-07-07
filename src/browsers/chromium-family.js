import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { CHROME_EXTENSION_ID, CHROMIUM_UNPACKED_DIR, NATIVE_HOST_NAME } from "../constants.js";
import { openBrowserHome, packageRoot } from "../util/paths.js";
import { expandHome, installNativeHost } from "./shared.js";

export class ChromiumFamilyAdapter {
  constructor(options) {
    this.name = options.name;
    this.displayName = options.displayName;
    this.nativeManifestRoots = options.nativeManifestRoots;
    this.launchCommands = options.launchCommands;
    this.registryRoots = options.registryRoots || [];
  }

  artifactPath() {
    return path.join(packageRoot(), CHROMIUM_UNPACKED_DIR);
  }

  async install() {
    const source = this.artifactPath();
    if (!fs.existsSync(source)) {
      throw new Error(`Missing Chromium extension artifact: ${source}. Run npm run build:chromium first.`);
    }

    const nativeHost = installNativeHost(this.name);
    const manifests = installNativeMessagingManifests(this.nativeManifestRoots, this.registryRoots, nativeHost);

    // Chromium browsers cannot side-load a packed extension from the profile the
    // way Firefox does, so stage the unpacked extension and let the user load it.
    const unpackedDir = path.join(openBrowserHome(), "extensions", this.name);
    fs.rmSync(unpackedDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(unpackedDir), { recursive: true });
    fs.cpSync(source, unpackedDir, { recursive: true });

    return {
      browser: this.name,
      unpackedExtension: unpackedDir,
      extensionId: CHROME_EXTENSION_ID,
      nativeHost,
      nativeManifests: manifests,
      note: `Load the OpenBrowser extension in ${this.displayName}: open the extensions page, enable Developer mode, choose "Load unpacked", and select ${unpackedDir}.`,
    };
  }

  async launch() {
    for (const command of this.launchCommands) {
      try {
        const child = spawn(command.command, command.args, {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
        return true;
      } catch {
        // Try the next known command.
      }
    }
    return false;
  }
}

function installNativeMessagingManifests(roots, registryRoots, hostPath) {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: "OpenBrowser local user-scoped native bridge",
    path: hostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${CHROME_EXTENSION_ID}/`],
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
      // Some candidate vendor directories may not be present on this platform.
    }
  }

  if (process.platform === "win32") {
    const manifestDir = path.join(openBrowserHome(), "native-messaging-hosts");
    fs.mkdirSync(manifestDir, { recursive: true });
    const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
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
