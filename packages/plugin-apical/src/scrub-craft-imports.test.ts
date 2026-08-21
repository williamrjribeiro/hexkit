import { describe, expect, it } from "vite-plus/test";

import { scrubUnusedCraftServerImports } from "./scrub-craft-imports.ts";

describe("scrubUnusedCraftServerImports", () => {
  it("removes unused ResponseMap, StandardSchemaV1, and createStandardSchemaValidationError imports", () => {
    const source = [
      'import type { StandardSchemaV1 } from "@standard-schema/spec";',
      "",
      'import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";',
      "",
      'import { serverRoute as deletePetRouteMetadata } from "../routes/deletePet.ts";',
      "",
      'import type { deletePetRouteResponse } from "../routes/deletePet.ts";',
      "",
      'import { deletePetResponseMap } from "../routes/deletePet.ts";',
      "",
      "type deletePetValidationError =",
      '  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false };',
      "",
      "export function deletePetWrapper() {",
      "  const pathParse = await validateStandardSchema(deletePetRouteMetadata.params.shape.path, {});",
      "  if (!pathParse.success) return pathParse.error;",
      "  return deletePetRouteMetadata;",
      "}",
      "",
    ].join("\n");

    const scrubbed = scrubUnusedCraftServerImports(source);

    expect(scrubbed).not.toContain("deletePetResponseMap");
    expect(scrubbed).not.toContain("StandardSchemaV1");
    expect(scrubbed).not.toContain("createStandardSchemaValidationError");
    expect(scrubbed).toContain("StandardSchemaValidationError");
    expect(scrubbed).toContain("validateStandardSchema");
    expect(scrubbed).toContain("deletePetRouteMetadata");
  });

  it("keeps imports that are referenced in the wrapper body", () => {
    const source = [
      'import type { StandardSchemaV1 } from "@standard-schema/spec";',
      "",
      'import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";',
      "",
      'import { addPetRequestMap } from "../routes/addPet.ts";',
      "",
      'import { addPetResponseMap } from "../routes/addPet.ts";',
      "",
      "type Body = StandardSchemaV1.InferOutput<(typeof addPetRequestMap)[keyof typeof addPetRequestMap]>;",
      "",
      "export function addPetWrapper() {",
      "  if (!true) {",
      '    return createStandardSchemaValidationError("missing");',
      "  }",
      '  const bodyParse = await validateStandardSchema(addPetRequestMap["application/json"], {});',
      "  return bodyParse as Body;",
      "}",
      "",
    ].join("\n");

    const scrubbed = scrubUnusedCraftServerImports(source);

    expect(scrubbed).toContain("StandardSchemaV1");
    expect(scrubbed).toContain("createStandardSchemaValidationError");
    expect(scrubbed).toContain("validateStandardSchema");
    expect(scrubbed).toContain("addPetRequestMap");
    expect(scrubbed).not.toContain("addPetResponseMap");
    expect(scrubbed).not.toMatch(/\btype StandardSchemaValidationError\b/);
  });
});
