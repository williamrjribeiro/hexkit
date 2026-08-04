import { spawn } from "node:child_process";
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
export type CraftRunner = (args: readonly string[]) => Promise<void>;

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
export async function generateContracts(
  options: GenerateContractsOptions,
  runCraft: CraftRunner = runCraftCli,
): Promise<void> {
  await runCraft(buildCraftGenerateArgs(options));
}

function runCraftCli(args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [resolveCraftBin(), ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    child.once("error", (error) => {
      reject(new Error(`Unable to start apical-ts craft: ${error.message}`, { cause: error }));
    });
    child.once("close", (status, signal) => {
      if (status === 0) {
        resolve();
        return;
      }

      const details = [...errors, ...output]
        .map((chunk) => chunk.toString("utf8").trim())
        .filter(Boolean)
        .join("\n");
      const termination = signal === null ? `exit code ${String(status)}` : `signal ${signal}`;
      reject(
        new Error(`apical-ts craft failed${details ? `:\n${details}` : ` with ${termination}`}`),
      );
    });
  });
}

function resolveCraftBin(): string {
  const craftPackageJson = require.resolve("@apical-ts/craft/package.json");
  return join(dirname(craftPackageJson), "bin", "craft.js");
}
