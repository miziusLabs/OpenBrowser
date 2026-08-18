<h1 align="center">
  <br>
  OpenBrowser
  <br>
</h1>

<h4 align="center">A minimal local browser-control CLI and agent skill that drives one owned browser tab through a WebExtension bridge.</h4>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="Version" src="https://img.shields.io/badge/version-2.2.0-blue?style=flat-square">
  <img alt="Browser" src="https://img.shields.io/badge/browser-Helium%20%7C%20Chrome%20%7C%20Zen-7F52FF?style=flat-square">
  <img alt="WebExtension" src="https://img.shields.io/badge/WebExtension-Firefox%20%7C%20Chromium-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white">
</p>

## Overview

OpenBrowser is a JavaScript browser-control package for local automation. It provides a CLI named `OpenBrowser`, a browser extension, and a user-scoped native bridge so tools and agents can control a single browser tab without exposing a public browser-control server.

OpenBrowser is intentionally conservative. Each supported browser may have at most one active OpenBrowser session, and that session is exactly one tab created and owned by OpenBrowser. It never closes, reuses, inspects, navigates, or modifies tabs opened manually by the user.

The npm package is published as `@pxlarified/browser` and is intended to be used through `npx`.

```sh
npx @pxlarified/browser <command>
```

The local agent skill lives in `skills/browser/` and can be installed from the npm package.

## License

This project uses the custom GREED-1 license. It grants permission only to fork the repository and make changes for submitting a pull request upstream; no other use, distribution, or derivative-work rights are granted. Committed code is owned by the owners of this repository. See [LICENSE](LICENSE).

## Features

- Provides a minimal `OpenBrowser` CLI for browser session lifecycle, navigation, inspection, screenshots, scrolling, and interaction.
- Controls exactly one OpenBrowser-owned tab per supported browser.
- Tracks the owned browser tab ID in extension storage and automatically clears the session if the user closes the tab.
- Communicates through a local, user-scoped native bridge instead of a publicly accessible network service.
- Uses temporary OpenBrowser-generated element references such as `e_1`, `e_2`, and `e_3`.
- Invalidates references after navigation or relevant DOM updates and returns stale-reference errors for old refs.
- Saves screenshots to `~/OpenBrowser/screenshots/<uuid>.png` or returns Base64 image data.
- Includes an extensible browser-adapter architecture covering Firefox-family and Chromium-family browsers.
- Supports Helium and Chrome (Chromium-based) plus Zen (Firefox-based).
- Detects supported browsers and lets you configure a local default so `--browser` is optional.
- Reports installed, configured, and active browser targets with `browsers`.
- Includes a minimal extension logo and uses it as the Firefox extension icon.
- Builds the Firefox extension into a bundled `.xpi` artifact.
- Includes a release-signing pipeline for Mozilla unlisted signing with `web-ext sign --channel unlisted`.

## Requirements

- Node.js 20 or newer.
- npm access to install or run `@pxlarified/browser`.
- A supported browser: Helium or Chrome (Chromium-based), or Zen (Firefox-based).
- For Zen, a Zen profile created on disk. Open Zen once before running setup.
- For Helium and Chrome, Developer mode enabled so the staged extension can be loaded unpacked.
- For signed Firefox releases, Mozilla Add-ons API credentials.

## Installation

The recommended first-run setup detects the local browser targets and remembers the one you choose.

```sh
npx @pxlarified/browser browsers
npx @pxlarified/browser setup helium
# or: setup chrome / setup zen
```

`setup` installs the native bridge and extension for the selected browser. For Zen it copies the Firefox `.xpi` into detected profiles. For Chromium browsers it stages one shared MV3 extension artifact under `~/OpenBrowser/extensions/<browser>/` and writes the browser-specific native-messaging manifest.

Chromium browsers cannot side-load a packed extension from a profile. After setup, open the browser's extensions page, enable Developer mode, choose "Load unpacked", and select the path reported by setup. Helium and Chrome use the same extension artifact, but keep separate native-host launchers and bridge sockets.

The setup command stores the selected browser in `~/OpenBrowser/config.json`. Each user has their own selection; no browser preference is stored in the repository.

### Browser selection

Use the friendly `use` command to change the local default:

```sh
npx @pxlarified/browser use helium
npx @pxlarified/browser use chrome
npx @pxlarified/browser use zen
npx @pxlarified/browser use auto
```

`config browser <browser>` remains available as an equivalent configuration command. `auto` selects an active browser first, then a configured/ready browser, then the only detected browser. If the detected browser is not set up, OpenBrowser tells you to run setup. If multiple browsers are possible, OpenBrowser reports the choices instead of silently selecting Zen.

Selection precedence is `--browser`, `OPENBROWSER_BROWSER`, an active session, the configured local browser, then automatic discovery. Use `browsers --json` for machine-readable discovery information.

### Agent skill installation

Install the bundled `browser` skill into a Pi agent directory or an existing `skills` directory.

```sh
npx @pxlarified/browser install skills --to '.pi/agent/'
# alias:
npx @pxlarified/browser install skill --to '.pi/agent/'
```

If `--to` points at an agent directory such as `.pi/agent`, OpenBrowser writes `.pi/agent/skills/browser/SKILL.md`. If `--to` already points at `.pi/agent/skills`, it writes `.pi/agent/skills/browser/SKILL.md` without appending another `skills` segment.

## Usage

After setup, browser selection is automatic and commands do not need a browser flag.

```sh
npx @pxlarified/browser open https://example.com
npx @pxlarified/browser state
npx @pxlarified/browser click e_1
npx @pxlarified/browser screenshot
npx @pxlarified/browser close
```

Use `--browser <browser>` when deliberately controlling a specific browser:

```sh
npx @pxlarified/browser state --browser helium
npx @pxlarified/browser screenshot --browser chrome
```

### Browser status and session lifecycle

```sh
npx @pxlarified/browser browsers
npx @pxlarified/browser browsers --json
npx @pxlarified/browser setup helium
npx @pxlarified/browser open <url>
npx @pxlarified/browser close
npx @pxlarified/browser status
```

### Navigation

```sh
npx @pxlarified/browser navigate <url>
npx @pxlarified/browser reload
npx @pxlarified/browser back
npx @pxlarified/browser forward
```

### Page state

```sh
npx @pxlarified/browser state
```

`state` returns the current URL, page title, viewport information, and actionable elements.

```json
{"url":"https://example.com","title":"Example Domain","elements":[{"ref":"e_1","role":"link","name":"More information"}]}
```

### Screenshots

```sh
npx @pxlarified/browser screenshot
npx @pxlarified/browser screenshot --base64
```

`screenshot` saves a PNG file under the user OpenBrowser directory and prints only the absolute file path to stdout.

```text
~/OpenBrowser/screenshots/<8-character-uuid>.png
```

`screenshot --base64` prints only the Base64-encoded PNG data to stdout. Diagnostic logs are written to stderr.

### Interaction

```sh
npx @pxlarified/browser click <ref>
npx @pxlarified/browser keys <text>
npx @pxlarified/browser press <key>
npx @pxlarified/browser select <ref> <option>
```

### Content inspection

```sh
npx @pxlarified/browser get --html
npx @pxlarified/browser get --html --ref <ref>
```

### Scrolling

```sh
npx @pxlarified/browser scroll up [pixels]
npx @pxlarified/browser scroll down [pixels]
npx @pxlarified/browser scroll --to <ref>
```

## Session model

OpenBrowser follows a strict ownership model.

1. Creating a session opens one new browser tab.
2. A session may never contain more than one tab.
3. `open` fails if an OpenBrowser session already exists for that browser.
4. `close` closes only the tab owned by OpenBrowser.
5. OpenBrowser never controls tabs the user opened manually.
6. If the user manually closes the OpenBrowser-owned tab, the session is considered closed automatically.
7. Opening a new session requires the existing OpenBrowser session to be closed first.

## References

Actionable elements use temporary OpenBrowser-generated references. These references do not depend on raw webpage HTML IDs.

References become invalid after navigation or relevant DOM updates. Commands that use invalid references return a `STALE_REFERENCE` error. Run `state` again to get fresh references.

## Browser support

OpenBrowser separates browser targets from browser families so browser-specific discovery and installation can reuse the same control implementation.

Currently supported browser IDs.

- `zen` - Firefox-based browser, installed through a signed `.xpi` artifact.
- `chrome` - Chromium-based browser, loaded unpacked from the MV3 artifact.
- `helium` - Chromium-based browser, loaded unpacked from the same MV3 artifact.

Other Firefox-family and Chromium-family browsers can be added by registering their application, profile, launch, and native-messaging paths.

## Extension artifacts

The browser extension source lives in `extensions/`.

Build both extension artifacts.

```sh
npm run build
```

Build a single family.

```sh
npm run build:firefox
npm run build:chromium
```

The unsigned Firefox development artifact is written to.

```text
dist/extensions/firefox/openbrowser-dev.xpi
```

When a signed release artifact exists, the installer prefers.

```text
dist/extensions/firefox/openbrowser.xpi
```

Otherwise it falls back to the unsigned development artifact.

The Chromium build writes an MV3 extension. The installer loads the unpacked directory, and the `.zip` is provided for distribution.

```text
dist/extensions/chromium/unpacked/
dist/extensions/chromium/openbrowser.zip
```

## Firefox signing

Firefox release signing is handled as a separate release step. Save Mozilla Add-ons credentials in a local uncommitted `.env` file.

```env
AMO_JWT_ISSUER="..."
AMO_JWT_SECRET="..."
```

Then run.

```sh
npm run release:firefox
```

The release script submits the extension for Mozilla unlisted signing with `web-ext sign --channel unlisted` and bundles the resulting signed XPI at.

```text
dist/extensions/firefox/openbrowser.xpi
```

Equivalent signing command.

```sh
npx web-ext sign \
  --source-dir ./extensions/ \
  --channel unlisted \
  --api-key "$AMO_JWT_ISSUER" \
  --api-secret "$AMO_JWT_SECRET"
```

## Publishing

Build and validate the package before publishing.

```sh
npm install
npm run build
npx web-ext lint --source-dir extensions
npm pack --dry-run
```

Publish the package publicly.

```sh
npm publish --access public
```

The package is configured with.

```json
{
  "publishConfig": {
    "access": "public"
  }
}
```

The npm package includes the CLI, source, extension source, bundled extension artifacts, and the installable `skills/browser/` skill. It does not publish `.env`, `node_modules`, or build scratch files.

## Development

Install dependencies.

```sh
npm install
```

Build both extension artifacts.

```sh
npm run build
```

Run the CLI locally without publishing.

```sh
npm exec --package . OpenBrowser -- --help
```

Project entry points.

- Logo source - `assets/logo.svg`
- CLI - `bin/OpenBrowser.js`
- CLI implementation - `src/cli.js`
- Browser catalog - `src/browsers/catalog.js`
- Browser registry - `src/browsers/registry.js`
- Browser selection and discovery - `src/browsers/selection.js`
- Zen adapter - `src/browsers/zen.js`
- Chrome adapter - `src/browsers/chrome.js`
- Helium adapter - `src/browsers/helium.js`
- Firefox-family installer - `src/browsers/firefox-family.js`
- Chromium-family installer - `src/browsers/chromium-family.js`
- Default-browser config - `src/util/config.js`
- Native bridge host - `src/native-host.cjs`
- Extension background script - `extensions/background.js`
- Extension content script - `extensions/content.js`
