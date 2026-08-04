import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import viteConfig from "../../../vite.config.ts";

type RootRunConfig = {
  cache?: unknown;
  tasks?: Record<string, unknown>;
};

const run = (viteConfig as { run?: RootRunConfig }).run;
const sampleManifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

describe("Given the root dogfood task", () => {
  it("when configured, then the supported entry point cannot cache acceptance", () => {
    expect(run?.tasks?.dogfood).toEqual({
      command: "apps/petstore-sample/scripts/dogfood.sh",
      cache: false,
    });
  });

  it("when entry points are inspected, then no cacheable package acceptance script remains", () => {
    expect(run?.cache).toBe(true);
    expect(sampleManifest.scripts).not.toHaveProperty("dogfood");
    expect(sampleManifest.scripts).not.toHaveProperty("test:api");
    expect(sampleManifest.scripts).not.toHaveProperty("test:api-url");
  });
});
