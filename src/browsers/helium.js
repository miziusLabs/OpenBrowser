import { ChromiumFamilyAdapter } from "./chromium-family.js";
import { getBrowserDefinition } from "./catalog.js";

export class HeliumBrowserAdapter extends ChromiumFamilyAdapter {
  constructor() {
    super(getBrowserDefinition("helium"));
  }
}
