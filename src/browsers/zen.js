import { FirefoxFamilyAdapter } from "./firefox-family.js";
import { getBrowserDefinition } from "./catalog.js";

export class ZenBrowserAdapter extends FirefoxFamilyAdapter {
  constructor() {
    super(getBrowserDefinition("zen"));
  }
}
