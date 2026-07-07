---
name: browser
description: Use a web browser.
---

## OpenBrowser

Run commands through the npm package.
```bash
npx @pxlarified/browser <command>
```

Close the session after you are done (unless it contains important information or you want to keep it warm for another session).

### Usage 
`--browser <browser>` selects the browser (`zen` or `chrome`). It is optional and
defaults to the browser set with `config browser`, or Zen when none is configured.

```bash
# Installation
npx @pxlarified/browser install zen
npx @pxlarified/browser install chrome

# Default browser (used when --browser is omitted)
npx @pxlarified/browser config browser chrome

# Session management
npx @pxlarified/browser open <url> --browser zen
npx @pxlarified/browser close --browser zen
npx @pxlarified/browser status --browser zen

# Navigation
npx @pxlarified/browser navigate <url> --browser zen
npx @pxlarified/browser reload --browser zen
npx @pxlarified/browser back --browser zen
npx @pxlarified/browser forward --browser zen

# Page state
npx @pxlarified/browser state --browser zen

# Screenshots
npx @pxlarified/browser screenshot --browser zen
npx @pxlarified/browser screenshot --base64 --browser zen

# Interaction
npx @pxlarified/browser click <ref> --browser zen
npx @pxlarified/browser keys <text> --browser zen
npx @pxlarified/browser press <key> --browser zen
npx @pxlarified/browser select <ref> <option> --browser zen

# Content inspection
npx @pxlarified/browser get --html --browser zen
npx @pxlarified/browser get --html --ref <ref> --browser zen

# Scrolling
npx @pxlarified/browser scroll up [pixels] --browser zen
npx @pxlarified/browser scroll down [pixels] --browser zen
npx @pxlarified/browser scroll --to <ref> --browser zen
```
