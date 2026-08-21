import { compareText } from "@hexkit/codegen";
import type { PersistenceArtifact } from "@hexkit/plugin-drizzle";

export type RuntimeRepositoryBinding = {
  runtimeKey: string;
  factoryName: string;
  filePath: string;
};

export type HttpArtifactLabel = "HttpArtifact" | "NextHttpArtifact";

export function resolveRuntimeRepositories(input: {
  httpKeys: ReadonlySet<string>;
  persistence: PersistenceArtifact;
  httpLabel: HttpArtifactLabel;
}): RuntimeRepositoryBinding[] {
  const { httpKeys, persistence, httpLabel } = input;

  for (const repository of persistence.repositories) {
    if (!httpKeys.has(repository.runtimeKey)) {
      throw new Error(
        `PersistenceArtifact repository runtime key "${repository.runtimeKey}" is missing from ${httpLabel} repositories.`,
      );
    }
  }

  const persistenceKeys = new Set(
    persistence.repositories.map((repository) => repository.runtimeKey),
  );
  for (const httpKey of httpKeys) {
    if (!persistenceKeys.has(httpKey)) {
      throw new Error(
        `${httpLabel} repository parameter "${httpKey}" has no PersistenceArtifact factory binding.`,
      );
    }
  }

  return [...persistence.repositories]
    .map((repository) => ({
      runtimeKey: repository.runtimeKey,
      factoryName: repository.factoryName,
      filePath: repository.filePath,
    }))
    .toSorted((left, right) => compareText(left.runtimeKey, right.runtimeKey));
}
