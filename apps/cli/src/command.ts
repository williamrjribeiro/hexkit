export const HELP_TEXT = `Hexkit

Usage:
  hexkit generate <openapi> <output>
  hexkit --help

Commands:
  generate  Generate a compose-ready application from an OpenAPI document

Options:
  -h, --help  Show this help`;

export type ParsedArguments =
  | { kind: "help" }
  | { kind: "generate"; inputPath: string; outputDirectory: string }
  | { kind: "error"; message: string };

export type CliDependencies = {
  generate(inputPath: string, outputDirectory: string): Promise<void>;
  log(text: string): void;
};

export function parseArguments(arguments_: readonly string[]): ParsedArguments {
  const [command, inputPath, outputDirectory, ...extraArguments] = arguments_;

  if (command === undefined || command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command !== "generate") {
    return { kind: "error", message: `Unknown command: ${command}` };
  }

  if (inputPath === undefined) {
    return { kind: "error", message: "Missing OpenAPI input path." };
  }

  if (outputDirectory === undefined) {
    return { kind: "error", message: "Missing output directory." };
  }

  if (extraArguments.length > 0) {
    return { kind: "error", message: `Unexpected argument: ${extraArguments[0]}` };
  }

  return { kind: "generate", inputPath, outputDirectory };
}

export async function runCli(
  arguments_: readonly string[],
  dependencies: CliDependencies,
): Promise<number> {
  const command = parseArguments(arguments_);

  if (command.kind === "help") {
    dependencies.log(HELP_TEXT);
    return 0;
  }

  if (command.kind === "error") {
    dependencies.log(`Error: ${command.message}`);
    dependencies.log(HELP_TEXT);
    return 1;
  }

  await dependencies.generate(command.inputPath, command.outputDirectory);
  return 0;
}
