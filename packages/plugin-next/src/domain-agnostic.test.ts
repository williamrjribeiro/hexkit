import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";

const packageRoot = join(import.meta.dirname, "..");

const productionSourceRoot = join(packageRoot, "src");

const bannedPattern =
  /\bPet\b|\bOrder\b|\bCategory\b|\bTag\b|petstore|addPet|updatePet|getPetById|deletePet|placeOrder|getOrderById|deleteOrder|available|pending|sold|placed|approved|delivered|\/pet|\/store\/order/;

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

    for (const path of listProductionTypeScriptFiles(productionSourceRoot)) {
      const match = bannedPattern.exec(readFileSync(path, "utf8"));
      if (match) {
        hits.push({ path: relative(packageRoot, path), match: match[0] });
      }
    }

    expect(hits).toEqual([]);
  });
});
