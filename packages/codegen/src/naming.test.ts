import { describe, expect, it } from "vite-plus/test";

import {
  pluralizeCamelCase,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} from "./naming.ts";

describe("naming helpers", () => {
  it("converts identifiers across casings", () => {
    expect(toPascalCase("addPet")).toBe("AddPet");
    expect(toPascalCase("get-pet-by-id")).toBe("GetPetById");
    expect(toCamelCase("Pet")).toBe("pet");
    expect(toCamelCase("addPet")).toBe("addPet");
    expect(toKebabCase("getPetById")).toBe("get-pet-by-id");
    expect(toKebabCase("Pet")).toBe("pet");
    expect(toSnakeCase("petId")).toBe("pet_id");
    expect(toSnakeCase("PetStatus")).toBe("pet_status");
  });

  it("treats empty and separator-only values as empty identifiers", () => {
    expect(toPascalCase("")).toBe("");
    expect(toPascalCase("---")).toBe("");
    expect(toCamelCase("")).toBe("");
    expect(toCamelCase("___")).toBe("");
    expect(toKebabCase("")).toBe("");
    expect(toSnakeCase("")).toBe("");
  });

  it("pluralizes camelCase aggregate names", () => {
    expect(pluralizeCamelCase("Pet")).toBe("pets");
    expect(pluralizeCamelCase("Order")).toBe("orders");
    expect(pluralizeCamelCase("Book")).toBe("books");
    expect(pluralizeCamelCase("Status")).toBe("statuses");
    expect(pluralizeCamelCase("")).toBe("");
    expect(pluralizeCamelCase("---")).toBe("");
  });
});
