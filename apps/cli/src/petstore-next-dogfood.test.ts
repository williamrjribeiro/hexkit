import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const dogfoodScript = new URL("../../petstore-next/scripts/dogfood.sh", import.meta.url).pathname;

describe("Given PetShop Next dogfood", () => {
  it("when checking the generated tree, then next build runs before overlay so CI typechecks RSC pages Compose would build", () => {
    const script = readFileSync(dogfoodScript, "utf8");
    const generatedInstall = script.indexOf('install_next_app "$OUTPUT_DIR"');
    const generatedBuild = script.indexOf('build_next_app "$OUTPUT_DIR"');
    const overlay = script.indexOf('"$OVERLAY_SCRIPT" "$OUTPUT_DIR"');

    expect(generatedInstall).toBeGreaterThan(-1);
    expect(generatedBuild).toBeGreaterThan(-1);
    expect(overlay).toBeGreaterThan(-1);
    expect(generatedInstall).toBeLessThan(generatedBuild);
    expect(generatedBuild).toBeLessThan(overlay);
  });
});
