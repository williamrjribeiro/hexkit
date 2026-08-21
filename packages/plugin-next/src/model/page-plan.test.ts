import { describe, expect, it } from "vite-plus/test";

import type { NextHttpModel, NextUiPage } from "../artifact.ts";
import { coercePageArgument, planPageFiles } from "./page-plan.ts";

function page(
  overrides: Partial<NextUiPage> & Pick<NextUiPage, "filePath" | "operationId">,
): NextUiPage {
  return {
    openApiPath: overrides.openApiPath ?? "/items/{itemId}",
    useCaseAccessorName: overrides.useCaseAccessorName ?? overrides.operationId,
    paramNames: overrides.paramNames ?? ["itemId"],
    parameters: overrides.parameters ?? [{ name: "itemId", typeExpression: "string" }],
    ...overrides,
  };
}

function model(overrides: Partial<NextHttpModel>): NextHttpModel {
  return {
    surface: "both",
    routes: [],
    uiPages: [],
    repositories: [],
    ...overrides,
  };
}

describe("Given page argument coercion", () => {
  it("when a parameter is a path number, then Number() is applied", () => {
    expect(coercePageArgument({ name: "itemId", typeExpression: "number" }, ["itemId"])).toBe(
      'Number(params["itemId"] ?? "0")',
    );
  });

  it("when a parameter is a query boolean, then it is compared to true", () => {
    expect(coercePageArgument({ name: "active", typeExpression: "boolean" }, ["itemId"])).toBe(
      '(getSearchParam(searchParams, "active") ?? "false") === "true"',
    );
  });

  it("when a parameter is a query string, then it defaults to empty string", () => {
    expect(coercePageArgument({ name: "q", typeExpression: "string" }, ["itemId"])).toBe(
      'getSearchParam(searchParams, "q") ?? ""',
    );
  });

  it("when a parameter is a path string, then it defaults to empty string from params", () => {
    expect(coercePageArgument({ name: "itemId", typeExpression: "string" }, ["itemId"])).toBe(
      'params["itemId"] ?? ""',
    );
  });
});

describe("Given planPageFiles", () => {
  it("when a GET page has path, query boolean, and query string params, then the resource plan records coercions", () => {
    const searchPage = page({
      filePath: "app/ui/items/[itemId]/page.tsx",
      openApiPath: "/items/{itemId}",
      operationId: "searchItems",
      useCaseAccessorName: "searchItems",
      paramNames: ["itemId"],
      parameters: [
        { name: "itemId", typeExpression: "number" },
        { name: "active", typeExpression: "boolean" },
        { name: "q", typeExpression: "string" },
      ],
    });

    const plans = planPageFiles(
      model({
        surface: "both",
        uiPages: [searchPage],
      }),
    );
    const resource = plans.find((entry) => entry.kind === "resource");

    expect(resource).toEqual({
      kind: "resource",
      filePath: "app/ui/items/[itemId]/page.tsx",
      operationId: "searchItems",
      useCaseAccessorName: "searchItems",
      needsParams: true,
      needsSearchHelper: true,
      argumentExpressions: [
        'Number(params["itemId"] ?? "0")',
        '(getSearchParam(searchParams, "active") ?? "false") === "true"',
        'getSearchParam(searchParams, "q") ?? ""',
      ],
    });
  });

  it("when surface is routes-only, then the root page is API-only and no resource pages are planned", () => {
    const plans = planPageFiles(
      model({
        surface: "routes",
        routes: [
          {
            filePath: "app/items/route.ts",
            openApiPath: "/items",
            methods: [],
          },
        ],
        uiPages: [],
      }),
    );

    expect(plans.map((entry) => entry.kind)).toEqual(["layout", "root"]);
    expect(plans.find((entry) => entry.kind === "root")).toMatchObject({
      filePath: "app/page.tsx",
      variant: "routes-only",
    });
  });

  it("when a route occupies app/page.tsx, then the generated hub is omitted", () => {
    const plans = planPageFiles(
      model({
        surface: "both",
        routes: [
          {
            filePath: "app/route.ts",
            openApiPath: "/",
            methods: [],
          },
        ],
        uiPages: [
          page({
            filePath: "app/ui/page.tsx",
            openApiPath: "/",
            operationId: "getRootResource",
            paramNames: [],
            parameters: [],
          }),
        ],
      }),
    );

    expect(plans.some((entry) => entry.kind === "root")).toBe(false);
    expect(plans.filter((entry) => entry.kind === "resource")).toHaveLength(1);
  });
});
