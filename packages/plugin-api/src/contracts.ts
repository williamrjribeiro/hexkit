export type GeneratedFile = {
  path: string;
  contents: string;
  ownership: "generated" | "protected";
};

export type GenerationContext = {
  inputPath: string;
  outputDirectory: string;
  writeFile(file: GeneratedFile): void;
  log(message: string): void;
};

export type HexkitPlugin = {
  name: string;
  generate(context: GenerationContext): void;
};
