import { describe, expect, it } from "vite-plus/test";

import { normalizeContractArtifact } from "./contract/normalize.ts";
import {
  LIBRARY_SHAPED_NOUNS,
  createLibraryShapedOpenApi,
  createSeededLibraryContract,
  pickLibraryShapedNouns,
} from "./testing.ts";

describe("Given a seeded library-shaped noun picker", () => {
  it("when the same seed is reused, then parent and child nouns are identical", () => {
    expect(pickLibraryShapedNouns(1_234_567_890)).toEqual(pickLibraryShapedNouns(1_234_567_890));
  });

  it("when two nouns are picked, then they are distinct members of the shared noun list", () => {
    const nouns = pickLibraryShapedNouns(42);

    expect(LIBRARY_SHAPED_NOUNS).toContain(nouns.parent);
    expect(LIBRARY_SHAPED_NOUNS).toContain(nouns.child);
    expect(nouns.parent).not.toBe(nouns.child);
    expect(nouns.seed).toBe(42);
  });
});

describe("Given a seeded library-shaped OpenAPI document", () => {
  it("when the document is normalized, then schemas and operations follow the picked nouns", () => {
    const sample = createSeededLibraryContract(7);
    const { parent, child } = sample.nouns;
    const { parentId, createOperationId, getOperationId, collectionPath, itemPath } = sample.names;

    expect(sample.contract.schemas.map((schema) => schema.name).toSorted()).toEqual(
      [parent, child].toSorted(),
    );
    expect(sample.contract.operations.map((operation) => operation.operationId).toSorted()).toEqual(
      [createOperationId, getOperationId].toSorted(),
    );
    expect(sample.contract.operations.map((operation) => operation.path).toSorted()).toEqual(
      [collectionPath, itemPath].toSorted(),
    );
    expect(
      sample.contract.schemas
        .find((schema) => schema.name === child)
        ?.properties.map((property) => property.name),
    ).toEqual(["id", parentId, "title"]);

    expect(
      normalizeContractArtifact(createLibraryShapedOpenApi(sample.nouns), sample.modules),
    ).toEqual(sample.contract);
  });
});
