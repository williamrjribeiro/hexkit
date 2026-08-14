#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { main } from "./main.ts";

export { HELP_TEXT, parseArguments, runCli } from "./command.ts";
export type { CliDependencies, ParsedArguments } from "./command.ts";
export { createDefaultPlugins, generateApplication, main } from "./main.ts";
export type { GenerateApplicationOptions, MainOptions } from "./main.ts";
export {
  createPackagingPlugin,
  generateNextPackagingFiles,
  generatePackagingFiles,
} from "./packaging-plugin.ts";
export type { NextPackagingInputs, PackagingInputs } from "./packaging-plugin.ts";

const executablePath = process.argv[1];
if (
  executablePath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executablePath)).href
) {
  process.exitCode = await main(process.argv.slice(2));
}
