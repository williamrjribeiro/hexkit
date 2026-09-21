import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const dogfoodScript = new URL("../../petstore-next/scripts/dogfood.sh", import.meta.url).pathname;

describe("Given PetShop Next dogfood", () => {
  it("when checking the overlaid tree, then a single next build runs after overlay so CI typechecks fixture UI and generated RSC pages once", () => {
    const script = readFileSync(dogfoodScript, "utf8");
    const overlay = script.indexOf('"$OVERLAY_SCRIPT" "$OUTPUT_DIR"');
    const overlaidInstall = script.indexOf('install_next_app "$OUTPUT_DIR"');
    const overlaidBuild = script.indexOf('build_next_app "$OUTPUT_DIR"');
    const fixtureBuild = script.indexOf("vp run build");

    expect(overlay).toBeGreaterThan(-1);
    expect(overlaidInstall).toBeGreaterThan(-1);
    expect(overlaidBuild).toBeGreaterThan(-1);
    expect(overlay).toBeLessThan(overlaidInstall);
    expect(overlaidInstall).toBeLessThan(overlaidBuild);
    // Fixture `next build` is redundant: the overlaid temp tree already includes
    // PetShop pages, generated routes, and app/ui/** RSC scaffolds.
    expect(fixtureBuild).toBe(-1);
  });
});
