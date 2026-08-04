import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const script = readFileSync(new URL("../scripts/dogfood.sh", import.meta.url), "utf8");

describe("Given a configured dogfood API URL", () => {
  it("when acceptance starts, then the script invokes Vitest directly with the URL", () => {
    const acceptanceInvocation = script
      .split("\n")
      .filter((line) => line.includes("tests/api.test.ts"));

    expect(acceptanceInvocation).toMatchInlineSnapshot(`
      [
        "  PETSTORE_API_URL="$API_BASE_URL" vp test run tests/api.test.ts",
      ]
    `);
    expect(script).not.toContain("vp run @hexkit/petstore-sample#test:api");
  });
});
