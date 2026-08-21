import { describe, expect, it } from "vite-plus/test";

import { mergeImports, renderImports } from "./imports.ts";
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

  it("when the same module has value and type imports, then they sort by typeOnly", () => {
    expect(
      renderImports([
        { from: "zod", names: ["z"] },
        { from: "zod", names: ["ZodType"], typeOnly: true },
        { from: "zod", names: ["ZodError"], typeOnly: false },
      ]),
    ).toBe(
      ['import { ZodError, z } from "zod";', 'import type { ZodType } from "zod";'].join("\n"),
    );
  });

  it("when an import declaration has no names, then it is omitted", () => {
    expect(
      renderImports([
        { from: "zod", names: [] },
        { from: "./contracts.js", names: ["Pet"], typeOnly: true },
      ]),
    ).toBe('import type { Pet } from "./contracts.js";');
  });

  it("when imports are merged, then empty names are dropped and names are sorted", () => {
    expect(
      mergeImports([
        { from: "zod", names: ["z", "ZodError"] },
        { from: "zod", names: [] },
        { from: "zod", names: ["z"], typeOnly: true },
      ]),
    ).toEqual([
      { from: "zod", names: ["ZodError", "z"], typeOnly: false },
      { from: "zod", names: ["z"], typeOnly: true },
    ]);
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

  it("when imports are omitted, then only non-empty statements are rendered", () => {
    expect(
      renderSourceFile({
        statements: ["export const value = 1;", "", "export const other = 2;"],
      }),
    ).toBe("export const value = 1;\n\nexport const other = 2;\n");
  });

  it("when statements are empty and imports are empty, then the result is empty", () => {
    expect(renderSourceFile({ statements: [] })).toBe("");
    expect(renderSourceFile({ imports: [], statements: [""] })).toBe("");
  });

  it("when only imports are present, then statements are omitted", () => {
    expect(
      renderSourceFile({
        imports: [{ from: "zod", names: ["z"] }],
        statements: [""],
      }),
    ).toBe('import { z } from "zod";\n');
  });
});
