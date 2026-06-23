<h1 align="center">
  <br>
  OpenBrowser
  <br>
</h1>

<h4 align="center">A minimal local browser-control CLI and agent skill that drives one owned browser tab through a WebExtension bridge.</h4>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white">
  <img alt="Version" src="https://img.shields.io/badge/version-1.9.9-blue?style=flat-square">
  <img alt="Browser" src="https://img.shields.io/badge/browser-Zen-7F52FF?style=flat-square">
  <img alt="Firefox Extension" src="https://img.shields.io/badge/Firefox-WebExtension-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white">
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

This project uses a custom fork-for-pull-request-only license. It grants permission only to fork the repository and make changes for submitting a pull request upstream; no other use, distribution, or derivative-work rights are granted. See [LICENSE](LICENSE).

## Features

- Provides a minimal `OpenBrowser` CLI for browser session lifecycle, navigation, inspection, screenshots, scrolling, and interaction.
- Controls exactly one OpenBrowser-owned tab per supported browser.
- Tracks the owned browser tab ID in extension storage and automatically clears the session if the user closes the tab.
- Communicates through a local, user-scoped native bridge instead of a publicly accessible network service.
- Uses temporary OpenBrowser-generated element references such as `e_1`, `e_2`, and `e_3`.
- Invalidates references after navigation or relevant DOM updates and returns stale-reference errors for old refs.
- Saves screenshots to `~/OpenBrowser/screenshots/<uuid>.png` or returns Base64 image data.
- Includes an extensible browser-adapter architecture for future Firefox-family and Chromium-family browsers.
- Initially supports Zen, a Firefox-based browser.
- Includes a minimal extension logo and uses it as the Firefox extension icon.
- Builds the Firefox extension into a bundled `.xpi` artifact.
- Includes a release-signing pipeline for Mozilla unlisted signing with `web-ext sign --channel unlisted`.

## Requirements

- Node.js 20 or newer.
- npm access to install or run `@pxlarified/browser`.
- Zen Browser for the initial supported browser target.
- A Zen profile created on disk. Open Zen once before running the installer.
- For signed Firefox releases, Mozilla Add-ons API credentials.

## Installation

Install the bundled extension and native bridge for Zen.

```sh
npx @pxlarified/browser install zen
```

The installer does the following.

1. Copies the bundled Firefox `.xpi` into detected Zen profiles as `openbrowser@mizius.com.xpi`.
2. Installs the user-scoped native messaging manifest.
3. Installs the native host launcher under `~/OpenBrowser/native-host/`.
4. Replaces an existing staged OpenBrowser extension with the bundled version.

Restart Zen if the extension update does not load immediately.

### Agent skill installation

Install the bundled `browser` skill into a Pi agent directory or an existing `skills` directory.

```sh
npx @pxlarified/browser install skills --to '.pi/agent/'
# alias:
npx @pxlarified/browser install skill --to '.pi/agent/'
```

If `--to` points at an agent directory such as `.pi/agent`, OpenBrowser writes `.pi/agent/skills/browser/SKILL.md`. If `--to` already points at `.pi/agent/skills`, it writes `.pi/agent/skills/browser/SKILL.md` without appending another `skills` segment.

## Usage

`--browser zen` is optional while Zen is the only supported browser.

```sh
npx @pxlarified/browser open https://example.com --browser zen
npx @pxlarified/browser state --browser zen
npx @pxlarified/browser click e_1 --browser zen
npx @pxlarified/browser screenshot --browser zen
npx @pxlarified/browser close --browser zen
```

### Session lifecycle

```sh
npx @pxlarified/browser install zen
npx @pxlarified/browser open <url> --browser zen
npx @pxlarified/browser close --browser zen
npx @pxlarified/browser status --browser zen
```

### Navigation

```sh
npx @pxlarified/browser navigate <url> --browser zen
npx @pxlarified/browser reload --browser zen
npx @pxlarified/browser back --browser zen
npx @pxlarified/browser forward --browser zen
```

### Page state

```sh
npx @pxlarified/browser state --browser zen
```

`state` returns the current URL, page title, viewport information, and actionable elements.

```json
{"url":"https://example.com","title":"Example Domain","elements":[{"ref":"e_1","role":"link","name":"More information"}]}
```

### Screenshots

```sh
npx @pxlarified/browser screenshot --browser zen
npx @pxlarified/browser screenshot --base64 --browser zen
```

`screenshot` saves a PNG file under the user OpenBrowser directory and prints only the absolute file path to stdout.

```text
~/OpenBrowser/screenshots/<8-character-uuid>.png
```

`screenshot --base64` prints only the Base64-encoded PNG data to stdout. Diagnostic logs are written to stderr.

### Interaction

```sh
npx @pxlarified/browser click <ref> --browser zen
npx @pxlarified/browser keys <text> --browser zen
npx @pxlarified/browser press <key> --browser zen
npx @pxlarified/browser select <ref> <option> --browser zen
```

### Content inspection

```sh
npx @pxlarified/browser get --html --browser zen
npx @pxlarified/browser get --html --ref <ref> --browser zen
```

### Scrolling

```sh
npx @pxlarified/browser scroll up [pixels] --browser zen
npx @pxlarified/browser scroll down [pixels] --browser zen
npx @pxlarified/browser scroll --to <ref> --browser zen
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

OpenBrowser uses browser-specific adapters so additional browsers can be added later.

Currently supported.

- Zen - Firefox-based browser.

Planned architecture support.

- Firefox-family browsers through signed `.xpi` artifacts.
- Chromium-family browsers through `.zip` extension artifacts.

## Extension artifacts

The browser extension source lives in `extensions/`.

Build the Firefox development artifact.

```sh
npm run build:firefox
```

The unsigned development artifact is written to.

```text
dist/extensions/firefox/openbrowser-dev.xpi
```

When a signed release artifact exists, the installer prefers.

```text
dist/extensions/firefox/openbrowser.xpi
```

Otherwise it falls back to the unsigned development artifact.

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

Build the Firefox extension artifact.

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
- Zen adapter - `src/browsers/zen.js`
- Firefox-family installer - `src/browsers/firefox-family.js`
- Native bridge host - `src/native-host.cjs`
- Extension background script - `extensions/background.js`
- Extension content script - `extensions/content.js`
