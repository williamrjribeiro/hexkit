#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { main } from "./main.ts";

export { HELP_TEXT, parseArguments, runCli } from "./command.ts";
export type { CliDependencies, ParsedArguments } from "./command.ts";
export { createDefaultPlugins, generateApplication, main } from "./main.ts";
export { createPackagingPlugin, generatePackagingFiles } from "./packaging-plugin.ts";

const executablePath = process.argv[1];
if (
  executablePath !== undefined &&
  import.meta.url === pathToFileURL(resolve(executablePath)).href
) {
  process.exitCode = main(process.argv.slice(2));
}
