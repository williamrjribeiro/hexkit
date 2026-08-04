import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runPipeline, type FileWriterActions } from "@hexkit/core";
import { createApicalPlugin, type CraftRunner } from "@hexkit/plugin-apical";
import { createHexagonalPlugin } from "@hexkit/plugin-architecture-hexagonal";
import { createDrizzlePlugin } from "@hexkit/plugin-drizzle";
import { createHonoPlugin } from "@hexkit/plugin-hono";
import type { HexkitPlugin } from "@hexkit/plugin-api";

import { runCli } from "./command.ts";
import { createPackagingPlugin } from "./packaging-plugin.ts";

export function createDefaultPlugins(runCraft?: CraftRunner): readonly HexkitPlugin[] {
  return [
    createApicalPlugin(runCraft),
    createHexagonalPlugin(),
    createHonoPlugin(),
    createDrizzlePlugin(),
    createPackagingPlugin(),
  ];
}

function createNodeFileActions(log: (text: string) => void): FileWriterActions {
  return {
    exists: existsSync,
    write(path: string, contents: string) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents, "utf8");
    },
    log,
  };
}

export type GenerateApplicationOptions = {
  actions?: FileWriterActions;
  inputExists?: (path: string) => boolean;
  plugins?: readonly HexkitPlugin[];
  runCraft?: CraftRunner;
};

export function generateApplication(
  inputPath: string,
  outputDirectory: string,
  options: GenerateApplicationOptions = {},
): void {
  const actions = options.actions ?? createNodeFileActions(console.log);

  if (!(options.inputExists ?? existsSync)(inputPath)) {
    throw new Error(`OpenAPI input not found: ${inputPath}`);
  }

  runPipeline(
    {
      inputPath,
      outputDirectory,
      plugins: options.plugins ?? createDefaultPlugins(options.runCraft),
    },
    actions,
  );
}

export type MainOptions = {
  actions?: FileWriterActions;
  inputExists?: (path: string) => boolean;
  log?: (text: string) => void;
  runCraft?: CraftRunner;
};

export function main(
  arguments_: readonly string[],
  options: MainOptions | ((text: string) => void) = {},
): number {
  const resolvedOptions = typeof options === "function" ? { log: options } : options;
  const log = resolvedOptions.log ?? console.log;

  try {
    return runCli(arguments_, {
      generate(inputPath: string, outputDirectory: string) {
        generateApplication(inputPath, outputDirectory, {
          actions: resolvedOptions.actions ?? createNodeFileActions(log),
          inputExists: resolvedOptions.inputExists,
          runCraft: resolvedOptions.runCraft,
        });
      },
      log,
    });
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
