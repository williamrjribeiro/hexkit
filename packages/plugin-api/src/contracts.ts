export type GeneratedFile = {
  path: string;
  contents: string;
  ownership: "generated" | "protected";
};

declare const artifactType: unique symbol;

export type ArtifactKey<T> = {
  readonly name: string;
  readonly [artifactType]?: (artifact: T) => T;
};

export type ArtifactRegistry = {
  publish<T>(key: ArtifactKey<T>, artifact: T): void;
  require<T>(key: ArtifactKey<T>): T;
};

export class DuplicateArtifactError extends Error {
  constructor(key: { readonly name: string }) {
    super(`Artifact "${key.name}" has already been published.`);
    this.name = "DuplicateArtifactError";
  }
}

export class MissingArtifactError extends Error {
  constructor(key: { readonly name: string }) {
    super(`Required artifact "${key.name}" has not been published.`);
    this.name = "MissingArtifactError";
  }
}

export function createArtifactKey<T>(name: string): ArtifactKey<T> {
  if (name.trim().length === 0) {
    throw new Error("Artifact keys must have a non-empty name.");
  }

  return Object.freeze({ name });
}

export function createArtifactRegistry(): ArtifactRegistry {
  const artifacts = new Map<string, unknown>();

  return {
    publish<T>(key: ArtifactKey<T>, artifact: T) {
      if (artifacts.has(key.name)) {
        throw new DuplicateArtifactError(key);
      }

      artifacts.set(key.name, artifact);
    },
    require<T>(key: ArtifactKey<T>): T {
      if (!artifacts.has(key.name)) {
        throw new MissingArtifactError(key);
      }

      return artifacts.get(key.name) as T;
    },
  };
}

export type GenerationContext = {
  inputPath: string;
  outputDirectory: string;
  artifacts: ArtifactRegistry;
  writeFile(file: GeneratedFile): void;
  log(message: string): void;
};

export type HexkitPlugin = {
  name: string;
  generate(context: GenerationContext): void | Promise<void>;
};
