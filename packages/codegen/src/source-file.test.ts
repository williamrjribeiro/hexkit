import { describe, expect, it } from "vite-plus/test";

import { renderImports } from "./imports.ts";
import { renderSourceFile } from "./source-file.ts";

describe("Given unordered and repeated imports", () => {
  it("when imports are rendered, then the output is stable and deduplicated", () => {
    expect(
      renderImports([
        { from: "zod", names: ["z", "ZodType", "z"] },
        { from: "./contracts.js", names: ["Pet"], typeOnly: true },
        { from: "zod", names: ["ZodError"] },
      ]),
    ).toMatchSnapshot();
  });
});

describe("Given imports and source statements", () => {
  it("when a source file is rendered, then it has deterministic spacing and a final newline", () => {
    expect(
      renderSourceFile({
        imports: [
          { from: "zod", names: ["z"] },
          { from: "./contracts.js", names: ["Pet"], typeOnly: true },
        ],
        statements: [
          "export const PetSchema = z.object({ id: z.number() });",
          "export type StoredPet = Pet;",
        ],
      }),
    ).toMatchSnapshot();
  });
});
