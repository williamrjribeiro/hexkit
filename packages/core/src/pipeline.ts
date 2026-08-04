import {
  createArtifactRegistry,
  type GenerationContext,
  type HexkitPlugin,
} from "@hexkit/plugin-api";

import { createFileWriter, type FileWriterActions } from "./file-writer.ts";

export type PipelineOptions = {
  inputPath: string;
  outputDirectory: string;
  plugins: readonly HexkitPlugin[];
};

export async function runPipeline(
  options: PipelineOptions,
  actions: FileWriterActions,
): Promise<void> {
  const context: GenerationContext = {
    inputPath: options.inputPath,
    outputDirectory: options.outputDirectory,
    artifacts: createArtifactRegistry(),
    writeFile: createFileWriter(options.outputDirectory, actions),
    log(message: string) {
      actions.log(message);
    },
  };

  for (const plugin of options.plugins) {
    await plugin.generate(context);
  }
}
