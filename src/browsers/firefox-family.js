import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { EXTENSION_ID, FIREFOX_DEV_ARTIFACT, FIREFOX_SIGNED_ARTIFACT, NATIVE_HOST_NAME } from "../constants.js";
import { openBrowserHome, packageRoot } from "../util/paths.js";
import { expandHome, findRunningProcess, installNativeHost, uniqueExistingDirectories } from "./shared.js";

export class FirefoxFamilyAdapter {
  constructor(options) {
    this.name = options.name;
    this.displayName = options.displayName;
    this.profileRoots = options.profileRoots;
    this.launchCommands = options.launchCommands;
    this.nativeManifestRoots = options.nativeManifestRoots;
    this.processNames = options.processNames || [];
  }

  artifactPath() {
    const root = packageRoot();
    const signed = path.join(root, FIREFOX_SIGNED_ARTIFACT);
    if (fs.existsSync(signed)) return signed;
    return path.join(root, FIREFOX_DEV_ARTIFACT);
  }

  async install() {
    const artifact = this.artifactPath();
    if (!fs.existsSync(artifact)) {
      throw new Error(`Missing Firefox extension artifact: ${artifact}. Run npm run build:firefox first.`);
    }

    const runningProcess = findRunningProcess(this.processNames);
    if (runningProcess) {
      throw new Error(`${this.displayName} must be closed before installing or updating the OpenBrowser extension. Close ${this.displayName} and run install again.`);
    }

    const nativeHost = installNativeHost(this.name);
    const manifests = installNativeMessagingManifests(this.nativeManifestRoots, nativeHost);
    const profiles = this.findProfiles();
    if (profiles.length === 0) {
      throw new Error(`No ${this.displayName} profile was found. Open ${this.displayName} once, then run install again.`);
    }

    const installedExtensions = [];
    for (const profile of profiles) {
      const extensionsDir = path.join(profile, "extensions");
      fs.mkdirSync(extensionsDir, { recursive: true });
      const destination = path.join(extensionsDir, `${EXTENSION_ID}.xpi`);
      fs.copyFileSync(artifact, destination);
      installedExtensions.push(destination);
    }

    return {
      browser: this.name,
      artifact,
      signed: path.basename(artifact) === "openbrowser.xpi",
      profiles,
      installedExtensions,
      nativeHost,
      nativeManifests: manifests,
      note: "Extension install/update is staged in the profile. Start the browser to load it.",
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

  findProfiles() {
    const roots = this.profileRoots.map((root) => expandHome(root));
    const profiles = [];

    for (const root of roots) {
      const profilesIni = path.join(root, "profiles.ini");
      if (!fs.existsSync(profilesIni)) continue;
      profiles.push(...readProfilesIni(profilesIni, root));
    }

    return uniqueExistingDirectories(profiles);
  }
}

function installNativeMessagingManifests(roots, hostPath) {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: "OpenBrowser local user-scoped native bridge",
    path: hostPath,
    type: "stdio",
    allowed_extensions: [EXTENSION_ID],
  };

  const written = [];
  const manifestDirectoryName = process.platform === "linux" ? "native-messaging-hosts" : "NativeMessagingHosts";
  for (const root of roots.map((entry) => expandHome(entry))) {
    const dir = path.join(root, manifestDirectoryName);
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
    const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    written.push(manifestPath);
    try {
      spawn("reg", [
        "add",
        `HKCU\\Software\\Mozilla\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`,
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        manifestPath,
        "/f",
      ], { stdio: "ignore" });
    } catch {}
  }

  return written;
}

function readProfilesIni(file, root) {
  const text = fs.readFileSync(file, "utf8");
  const sections = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) continue;
    const section = line.match(/^\[(.+)]$/);
    if (section) {
      current = { name: section[1] };
      sections.push(current);
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1 || !current) continue;
    current[line.slice(0, separator)] = line.slice(separator + 1);
  }

  const profileSections = sections.filter((section) => section.name.startsWith("Profile") && section.Path);
  profileSections.sort((a, b) => Number(b.Default || 0) - Number(a.Default || 0));

  return profileSections.map((section) => {
    if (section.IsRelative === "1") return path.join(root, section.Path);
    return section.Path;
  });
}
