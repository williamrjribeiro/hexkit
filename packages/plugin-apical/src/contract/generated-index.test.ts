import { describe, expect, it } from "vite-plus/test";

import {
  inspectGeneratedIndexes,
  inspectRoutesIndex,
  inspectSchemaIndex,
} from "./generated-index.ts";

describe("inspectGeneratedIndexes", () => {
  it("uses the TypeScript AST to map exported schemas and route registry entries", () => {
    const modules = inspectGeneratedIndexes(
      `
        import { Book } from "./Book.ts";
        export { Book };
      `,
      `
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { getBook: getBookRoute } as const;
      `,
    );

    expect([...modules.schemas]).toEqual([["Book", "schemas/Book.ts"]]);
    expect([...modules.operations]).toEqual([["getBook", "routes/getBook.ts"]]);
  });

  it("supports re-export sources, string export names, and string route keys", () => {
    expect([
      ...inspectSchemaIndex(`
        export { Book as "BookModel" } from "./Book.ts";
        export { Tag } from "./Tag";
      `),
    ]).toEqual([
      ["BookModel", "schemas/Book.ts"],
      ["Tag", "schemas/Tag.ts"],
    ]);

    expect([
      ...inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { "getBook": getBookRoute } satisfies Record<string, unknown>;
      `),
    ]).toEqual([["getBook", "routes/getBook.ts"]]);
  });

  it("rejects unsupported generated index shapes", () => {
    expect(() => inspectSchemaIndex("export const x = (")).toThrow(/Unable to parse Apical index/);

    expect(() =>
      inspectSchemaIndex(`
        import { Book } from "book-pkg";
        export { Book };
      `),
    ).toThrow(/external module "book-pkg"/);

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = getBookRoute;
      `),
    ).toThrow('Apical export "routes" must be an object literal.');

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { ...getBookRoute };
      `),
    ).toThrow(/unsupported entry/);

    expect(() =>
      inspectRoutesIndex(`
        import { serverRoute as getBookRoute } from "./getBook.ts";
        export const routes = { [Symbol.iterator]: getBookRoute };
      `),
    ).toThrow(/unsupported entry|computed route key/);

    expect(() =>
      inspectRoutesIndex(`
        import { helper as getBookRoute } from "./getBook.ts";
        export const routes = { getBook: getBookRoute };
      `),
    ).toThrow(/not backed by an imported serverRoute module/);

    expect(() =>
      inspectRoutesIndex(`
        export const routes = { getBook: missing };
      `),
    ).toThrow(/not backed by an imported serverRoute module/);
  });
});
