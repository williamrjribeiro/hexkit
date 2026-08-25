import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
  type HexkitPlugin,
} from "@hexkit/plugin-api";
import {
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
  type GeneratedApicalModules,
} from "@hexkit/plugin-apical";

const DEFAULT_INPUT_PATH = "openapi.yaml";
const DEFAULT_OUTPUT_DIRECTORY = "/tmp/generated-app";

/**
 * Optional paths for an in-memory {@link GenerationContext}. Tests that never
 * touch the filesystem can omit both fields.
 */
export type CollectingContextOptions = {
  readonly inputPath?: string;
  readonly outputDirectory?: string;
};

/**
 * An in-memory generation run: the context plugins receive, plus the files
 * `writeFile` recorded during that run.
 */
export type CollectingGeneration = {
  readonly context: GenerationContext;
  readonly files: GeneratedFile[];
};

/**
 * Build a {@link GenerationContext} that records `writeFile` calls in `files`.
 * `log` is a no-op. Defaults: `inputPath` `"openapi.yaml"`, `outputDirectory`
 * `"/tmp/generated-app"`.
 */
export function createCollectingContext(
  options: CollectingContextOptions = {},
): CollectingGeneration {
  const files: GeneratedFile[] = [];
  const context: GenerationContext = {
    inputPath: options.inputPath ?? DEFAULT_INPUT_PATH,
    outputDirectory: options.outputDirectory ?? DEFAULT_OUTPUT_DIRECTORY,
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  };

  return { context, files };
}

/**
 * Create a collecting context, run optional `setup` (typically artifact
 * publishes), then `plugin.generate`. Returns the same `files` array and
 * context so callers can `require` plugin-owned artifacts.
 *
 * This helper does not import hexagonal application generation, so hexagonal
 * can consume it without a package cycle.
 */
export async function collectPluginOutput(
  plugin: HexkitPlugin,
  setup: (context: GenerationContext) => void | Promise<void> = () => {},
  options?: CollectingContextOptions,
): Promise<CollectingGeneration> {
  const collecting = createCollectingContext(options);
  await setup(collecting.context);
  await plugin.generate(collecting.context);
  return collecting;
}

/**
 * Load and validate an OpenAPI document, then normalize it with Craft module
 * maps. Callers supply fixture-specific schema and operation maps so this
 * helper stays free of sample-domain literals.
 */
export async function loadNormalizedContract(
  openApiPath: string,
  modules: GeneratedApicalModules,
): Promise<ContractArtifact> {
  return normalizeContractArtifact(await loadValidatedOpenApi(openApiPath), modules);
}
