import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const workspaceRoot = join(import.meta.dirname, "../../..");

const productionSourceRoots = [
  "packages/plugin-api/src",
  "packages/plugin-apical/src",
  "packages/plugin-architecture-hexagonal/src",
  "packages/plugin-drizzle/src",
  "packages/plugin-hono/src",
  "packages/plugin-next/src",
  "packages/shared/src",
  "packages/codegen/src",
  "packages/core/src",
  "apps/cli/src",
] as const;

const bannedPattern =
  /\bPet\b|\bOrder\b|petstore|addPet|updatePet|getPetById|deletePet|placeOrder|getOrderById|deleteOrder|available|pending|sold|placed|approved|delivered|\/pet|\/store\/order/;

function listProductionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__fixtures__" || entry.name === "__snapshots__") return [];
      return listProductionTypeScriptFiles(path);
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) return [];
    if (entry.name.endsWith(".test.ts")) return [];
    return [path];
  });
}

describe("Given production generator sources", () => {
  it("then they contain no Petstore-only fixture literals", () => {
    const hits: Array<{ path: string; match: string }> = [];

    for (const root of productionSourceRoots) {
      for (const path of listProductionTypeScriptFiles(join(workspaceRoot, root))) {
        const match = bannedPattern.exec(readFileSync(path, "utf8"));
        if (match) {
          hits.push({ path: relative(workspaceRoot, path), match: match[0] });
        }
      }
    }

    expect(hits).toEqual([]);
  });
});
