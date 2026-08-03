import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export type GenerateContractsOptions = {
  input: string;
  output: string;
  client?: boolean;
  server?: boolean;
  routes?: boolean;
};

const require = createRequire(import.meta.url);

/**
 * Runs @apical-ts/craft against an OpenAPI document and writes contracts,
 * Zod schemas, and operation definitions to `output`.
 */
export function generateContracts(options: GenerateContractsOptions): void {
  const args = ["generate", "-i", options.input, "-o", options.output];

  if (options.client) {
    args.push("--client");
  }
  if (options.server) {
    args.push("--server");
  }
  if (options.routes) {
    args.push("--routes");
  }

  const result = spawnSync(process.execPath, [resolveCraftBin(), ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n");
    throw new Error(
      `apical-ts craft failed${details ? `:\n${details}` : ` with exit code ${String(result.status)}`}`,
    );
  }
}

function resolveCraftBin(): string {
  const craftPackageJson = require.resolve("@apical-ts/craft/package.json");
  return join(dirname(craftPackageJson), "bin", "craft.js");
}
