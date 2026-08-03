import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { generateContracts } from "./generate-contracts.ts";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const petstoreOpenApi = join(packageRoot, "../../apps/petstore-sample/openapi.yaml");
const outputDir = join(packageRoot, "generated/petstore");

const require = createRequire(import.meta.url);
const tscBin = join(dirname(require.resolve("typescript/package.json")), "bin", "tsc");

describe("generateContracts", () => {
  afterEach(() => {
    rmSync(join(packageRoot, "generated"), { recursive: true, force: true });
  });

  it("generates Petstore contracts that typecheck with no errors", () => {
    rmSync(outputDir, { recursive: true, force: true });
    mkdirSync(outputDir, { recursive: true });

    generateContracts({
      input: petstoreOpenApi,
      output: outputDir,
      server: true,
      routes: true,
    });

    expect(existsSync(join(outputDir, "schemas", "index.ts"))).toBe(true);
    expect(existsSync(join(outputDir, "routes", "index.ts"))).toBe(true);
    expect(existsSync(join(outputDir, "server", "index.ts"))).toBe(true);

    // Craft also emits a nested package.json; typecheck against this package's
    // zod / @standard-schema/spec dependencies instead.
    rmSync(join(outputDir, "package.json"), { force: true });
    rmSync(join(outputDir, "tsconfig.json"), { force: true });

    const typecheck = spawnSync(
      process.execPath,
      [tscBin, "--noEmit", "-p", join(packageRoot, "tsconfig.generated.json")],
      {
        cwd: packageRoot,
        encoding: "utf8",
      },
    );

    expect(typecheck.status, typecheck.stdout + typecheck.stderr).toBe(0);
  });
});

it("resolves @apical-ts/craft from @hexkit/plugin-apical", () => {
  const craftPackageJson = require.resolve("@apical-ts/craft/package.json");
  const pkg = JSON.parse(readFileSync(craftPackageJson, "utf8")) as {
    name: string;
  };
  expect(pkg.name).toBe("@apical-ts/craft");
  expect(existsSync(join(dirname(craftPackageJson), "bin", "craft.js"))).toBe(true);
});
