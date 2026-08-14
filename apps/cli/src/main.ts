import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { runPipeline, type FileWriterActions } from "@hexkit/core";
import { createApicalPlugin, type ApicalPluginOptions } from "@hexkit/plugin-apical";
import { createHexagonalPlugin } from "@hexkit/plugin-architecture-hexagonal";
import { createDrizzlePlugin } from "@hexkit/plugin-drizzle";
import { createHonoPlugin } from "@hexkit/plugin-hono";
import { createNextPlugin, type NextSurface } from "@hexkit/plugin-next";
import type { HexkitPlugin } from "@hexkit/plugin-api";

import { runCli } from "./command.ts";
import type { HttpAdapter } from "./command.ts";
import { createPackagingPlugin } from "./packaging-plugin.ts";

export type DefaultPluginOptions = {
  apical?: ApicalPluginOptions;
  http?: HttpAdapter;
  nextSurface?: NextSurface;
};

export function createDefaultPlugins(options: DefaultPluginOptions = {}): readonly HexkitPlugin[] {
  const http = options.http ?? "hono";
  if (options.nextSurface !== undefined && http !== "next") {
    throw new Error("--next-surface can only be used with --http next.");
  }

  return [
    createApicalPlugin(options.apical ?? {}),
    createHexagonalPlugin(),
    http === "next"
      ? createNextPlugin({ surface: options.nextSurface ?? "both" })
      : createHonoPlugin(),
    createDrizzlePlugin(),
    createPackagingPlugin({ http }),
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
  apical?: ApicalPluginOptions;
  http?: HttpAdapter;
  inputExists?: (path: string) => boolean;
  nextSurface?: NextSurface;
  plugins?: readonly HexkitPlugin[];
};

export async function generateApplication(
  inputPath: string,
  outputDirectory: string,
  options: GenerateApplicationOptions = {},
): Promise<void> {
  const actions = options.actions ?? createNodeFileActions(console.log);

  if (!(options.inputExists ?? existsSync)(inputPath)) {
    throw new Error(`OpenAPI input not found: ${inputPath}`);
  }

  await runPipeline(
    {
      inputPath,
      outputDirectory,
      plugins:
        options.plugins ??
        createDefaultPlugins({
          apical: options.apical,
          http: options.http,
          nextSurface: options.nextSurface,
        }),
    },
    actions,
  );
}

export type MainOptions = {
  actions?: FileWriterActions;
  apical?: ApicalPluginOptions;
  http?: HttpAdapter;
  inputExists?: (path: string) => boolean;
  log?: (text: string) => void;
  nextSurface?: NextSurface;
  plugins?: readonly HexkitPlugin[];
};

export async function main(
  arguments_: readonly string[],
  options: MainOptions | ((text: string) => void) = {},
): Promise<number> {
  const resolvedOptions = typeof options === "function" ? { log: options } : options;
  const log = resolvedOptions.log ?? console.log;

  try {
    return await runCli(arguments_, {
      async generate(inputPath: string, outputDirectory: string, generationOptions) {
        await generateApplication(inputPath, outputDirectory, {
          actions: resolvedOptions.actions ?? createNodeFileActions(log),
          apical: resolvedOptions.apical,
          http: generationOptions.http,
          inputExists: resolvedOptions.inputExists,
          nextSurface: generationOptions.nextSurface,
          plugins: resolvedOptions.plugins,
        });
      },
      log,
    });
  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
