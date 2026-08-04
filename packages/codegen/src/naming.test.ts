import { describe, expect, it } from "vite-plus/test";

import { pluralizeCamelCase, toCamelCase, toKebabCase, toPascalCase } from "./naming.ts";

describe("naming helpers", () => {
  it("converts identifiers across casings", () => {
    expect(toPascalCase("addPet")).toBe("AddPet");
    expect(toPascalCase("get-pet-by-id")).toBe("GetPetById");
    expect(toCamelCase("Pet")).toBe("pet");
    expect(toCamelCase("addPet")).toBe("addPet");
    expect(toKebabCase("getPetById")).toBe("get-pet-by-id");
    expect(toKebabCase("Pet")).toBe("pet");
  });

  it("pluralizes camelCase aggregate names", () => {
    expect(pluralizeCamelCase("Pet")).toBe("pets");
    expect(pluralizeCamelCase("Order")).toBe("orders");
    expect(pluralizeCamelCase("Book")).toBe("books");
    expect(pluralizeCamelCase("Status")).toBe("statuses");
  });
});
