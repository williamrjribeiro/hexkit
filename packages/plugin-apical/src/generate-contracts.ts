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

/** Side-effectful craft invocation; injectable so calculations stay testable. */
export type CraftRunner = (args: readonly string[]) => void;

const require = createRequire(import.meta.url);

/**
 * Pure calculation: craft CLI args for a generate invocation.
 * Keeping this free of I/O makes Petstore wiring easy to unit test.
 */
export function buildCraftGenerateArgs(options: GenerateContractsOptions): string[] {
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

  return args;
}

/**
 * Action at the edge: run @apical-ts/craft with the calculated args.
 * Pass `runCraft` in tests to assert call arguments without spawning craft.
 */
export function generateContracts(
  options: GenerateContractsOptions,
  runCraft: CraftRunner = runCraftCli,
): void {
  runCraft(buildCraftGenerateArgs(options));
}

function runCraftCli(args: readonly string[]): void {
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
