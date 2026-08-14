export const HELP_TEXT = `Hexkit

Usage:
  hexkit generate <openapi> <output> [--http hono|next] [--next-surface both|routes|rsc]
  hexkit --help

Commands:
  generate  Generate a compose-ready application from an OpenAPI document

Options:
  --http <adapter>       Select HTTP adapter: hono (default) or next
  --next-surface <mode>  Select Next output when --http next: both (default), routes, or rsc
  -h, --help             Show this help`;

export type HttpAdapter = "hono" | "next";
export type NextSurfaceOption = "both" | "routes" | "rsc";

export type GenerateOptions = {
  http: HttpAdapter;
  nextSurface?: NextSurfaceOption;
};

export type ParsedArguments =
  | { kind: "help" }
  | {
      kind: "generate";
      inputPath: string;
      outputDirectory: string;
      http: HttpAdapter;
      nextSurface?: NextSurfaceOption;
    }
  | { kind: "error"; message: string };

export type CliDependencies = {
  generate(inputPath: string, outputDirectory: string, options: GenerateOptions): Promise<void>;
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

  const parsedOptions = parseGenerateOptions(extraArguments);
  if (parsedOptions.kind === "error") {
    return parsedOptions;
  }

  return {
    kind: "generate",
    inputPath,
    outputDirectory,
    http: parsedOptions.http,
    ...(parsedOptions.nextSurface === undefined ? {} : { nextSurface: parsedOptions.nextSurface }),
  };
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

  await dependencies.generate(command.inputPath, command.outputDirectory, {
    http: command.http,
    ...(command.nextSurface === undefined ? {} : { nextSurface: command.nextSurface }),
  });
  return 0;
}

function parseGenerateOptions(
  arguments_: readonly string[],
):
  | { kind: "generate-options"; http: HttpAdapter; nextSurface?: NextSurfaceOption }
  | { kind: "error"; message: string } {
  let http: HttpAdapter = "hono";
  let nextSurface: NextSurfaceOption | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === undefined) continue;

    if (argument === "--http") {
      const value = arguments_[index + 1];
      if (value === undefined) return { kind: "error", message: "--http requires a value." };
      if (!isHttpAdapter(value)) {
        return { kind: "error", message: `Unsupported HTTP adapter: ${value}` };
      }
      http = value;
      index += 1;
      continue;
    }

    if (argument === "--next-surface") {
      const value = arguments_[index + 1];
      if (value === undefined) {
        return { kind: "error", message: "--next-surface requires a value." };
      }
      if (!isNextSurface(value)) {
        return { kind: "error", message: `Unsupported Next surface: ${value}` };
      }
      nextSurface = value;
      index += 1;
      continue;
    }

    return { kind: "error", message: `Unexpected argument: ${argument}` };
  }

  if (nextSurface !== undefined && http !== "next") {
    return { kind: "error", message: "--next-surface can only be used with --http next." };
  }

  if (http === "next") {
    return { kind: "generate-options", http, nextSurface: nextSurface ?? "both" };
  }

  return { kind: "generate-options", http };
}

function isHttpAdapter(value: string): value is HttpAdapter {
  return value === "hono" || value === "next";
}

function isNextSurface(value: string): value is NextSurfaceOption {
  return value === "both" || value === "routes" || value === "rsc";
}
