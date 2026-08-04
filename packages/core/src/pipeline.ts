import type { GenerationContext, HexkitPlugin } from "@hexkit/plugin-api";

import { createFileWriter, type FileWriterActions } from "./file-writer.ts";

export type PipelineOptions = {
  inputPath: string;
  outputDirectory: string;
  plugins: readonly HexkitPlugin[];
};

export function runPipeline(options: PipelineOptions, actions: FileWriterActions): void {
  const context: GenerationContext = {
    inputPath: options.inputPath,
    outputDirectory: options.outputDirectory,
    writeFile: createFileWriter(options.outputDirectory, actions),
    log(message: string) {
      actions.log(message);
    },
  };

  for (const plugin of options.plugins) {
    plugin.generate(context);
  }
}
