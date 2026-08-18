---
name: browser
description: Use a web browser.
---

## OpenBrowser

Run commands through the npm package.
```bash
npx @pxlarified/browser <command>
```

OpenBrowser selects a local default browser automatically.

```bash
# Show or change the local default
npx @pxlarified/browser config browser
npx @pxlarified/browser use helium
npx @pxlarified/browser use auto

# Session management
npx @pxlarified/browser open https://example.com
npx @pxlarified/browser close
npx @pxlarified/browser status

# Navigation
npx @pxlarified/browser navigate https://example.com
npx @pxlarified/browser reload
npx @pxlarified/browser back
npx @pxlarified/browser forward

# Page state
npx @pxlarified/browser state

# Screenshots
npx @pxlarified/browser screenshot
npx @pxlarified/browser screenshot --base64

# Interaction
npx @pxlarified/browser click e_1
npx @pxlarified/browser keys "text to type"
npx @pxlarified/browser press Enter
npx @pxlarified/browser select e_1 option-value

# Content inspection
npx @pxlarified/browser get --html
npx @pxlarified/browser get --html --ref e_1

# Scrolling
npx @pxlarified/browser scroll up [pixels]
npx @pxlarified/browser scroll down [pixels]
npx @pxlarified/browser scroll --to e_1
```

Supported browser IDs are `helium`, `chrome`, and `zen`. Every command also accepts
`--browser <id>` as an explicit override. If more than one browser is active or
configured and no default is selected, OpenBrowser reports the choices instead of
silently choosing the wrong browser.

Close the session after you are done unless it contains important information or you
want to keep it warm.
