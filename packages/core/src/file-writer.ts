import { join } from "node:path";

import type { GeneratedFile } from "@hexkit/plugin-api";

export type FileWriterActions = {
  exists(path: string): boolean;
  write(path: string, contents: string): void;
  log(message: string): void;
};

export type FileWriteDecision = "write" | "skip";

export function decideFileWrite(
  ownership: GeneratedFile["ownership"],
  destinationExists: boolean,
): FileWriteDecision {
  return ownership === "protected" && destinationExists ? "skip" : "write";
}

export function createFileWriter(
  outputDirectory: string,
  actions: FileWriterActions,
): (file: GeneratedFile) => void {
  return (file) => {
    const outputPath = join(outputDirectory, file.path);
    const destinationExists = file.ownership === "protected" && actions.exists(outputPath);

    if (decideFileWrite(file.ownership, destinationExists) === "skip") {
      actions.log(`Skipped existing protected file: ${file.path}`);
      return;
    }

    actions.write(outputPath, file.contents);
  };
}
