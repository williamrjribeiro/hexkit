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
    write(path, contents) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, contents, "utf8");
    },
    log,
  };
}

export function generateApplication(
  inputPath: string,
  outputDirectory: string,
  options: {
    plugins?: readonly HexkitPlugin[];
    actions?: FileWriterActions;
  } = {},
): void {
  const actions = options.actions ?? createNodeFileActions(console.log);

  runPipeline(
    {
      inputPath,
      outputDirectory,
      plugins: options.plugins ?? createDefaultPlugins(),
    },
    actions,
  );
}

export function main(
  arguments_: readonly string[],
  log: (text: string) => void = console.log,
): number {
  try {
    return runCli(arguments_, {
      generate(inputPath, outputDirectory) {
        generateApplication(inputPath, outputDirectory, {
          actions: createNodeFileActions(log),
        });
      },
      log,
    });
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
