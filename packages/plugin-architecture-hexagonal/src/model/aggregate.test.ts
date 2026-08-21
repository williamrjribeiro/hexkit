import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import {
  inferAggregateFromPath,
  resolveAggregate,
  groupOperationsByAggregate,
} from "./aggregate.ts";

const publicSecurity = {
  overridesGlobal: true,
  requirements: [],
  apicalServerHeaderNames: [],
} as const;

const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
const schemaNames = new Set(["Item", "Order"]);

function operation(
  overrides: Partial<ContractOperation> & Pick<ContractOperation, "operationId" | "path">,
): ContractOperation {
  return {
    method: "get",
    modulePath: `routes/${overrides.operationId}.ts`,
    parameters: [],
    responses: [{ status: "200", description: "ok", media: [] }],
    security: publicSecurity,
    ...overrides,
  };
}

describe("Given path segments and schema names", () => {
  it.each([
    {
      path: "/items",
      expected: "Item",
      reason: "trailing resource segment matches after stripping a trailing s",
    },
    {
      path: "/inventory/items",
      expected: "Item",
      reason: "the last non-parameter segment wins",
    },
    {
      path: "/Orders",
      expected: "Order",
      reason: "matching is case-insensitive",
    },
    {
      path: "/inventory/{itemId}",
      expected: "Item",
      reason: "an {itemId}-style parameter names the aggregate",
    },
    {
      path: "/widgets/{orderId}/line",
      expected: "Order",
      reason: "an id-suffixed parameter matches even when segments do not",
    },
  ] as const)("when the path is $path, then $reason", ({ path, expected }) => {
    expect(inferAggregateFromPath(path, schemaNames)).toBe(expected);
  });

  it("when no segment or id parameter matches a schema, then the result is undefined", () => {
    expect(inferAggregateFromPath("/unknown/{value}", schemaNames)).toBeUndefined();
    expect(inferAggregateFromPath("/items/{id}", new Set(["Widget"]))).toBeUndefined();
  });
});

describe("Given a contract operation", () => {
  it("when x-hexkit.operation.aggregate is set, then that name wins", () => {
    expect(
      resolveAggregate(
        operation({
          operationId: "custom",
          path: "/orders",
          extension: { aggregate: "Item", action: "custom" },
        }),
        schemaNames,
      ),
    ).toBe("Item");
  });

  it("when the request body references a known schema, then that schema is the aggregate", () => {
    expect(
      resolveAggregate(
        operation({
          operationId: "createItem",
          method: "post",
          path: "/things",
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        }),
        schemaNames,
      ),
    ).toBe("Item");
  });

  it("when only an error response references a schema, then success media is used instead", () => {
    expect(
      resolveAggregate(
        operation({
          operationId: "createItem",
          method: "post",
          path: "/things",
          responses: [
            {
              status: "400",
              description: "bad",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
            {
              status: "201",
              description: "created",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Order" },
                },
              ],
            },
          ],
        }),
        schemaNames,
      ),
    ).toBe("Order");
  });

  it("when request media is not a schema reference, then the success response is used", () => {
    expect(
      resolveAggregate(
        operation({
          operationId: "echo",
          method: "post",
          path: "/echo",
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: { kind: "string", nullable: false },
              },
            ],
          },
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          ],
        }),
        schemaNames,
      ),
    ).toBe("Item");
  });

  it("when media does not name a schema, then the path is used", () => {
    expect(
      resolveAggregate(
        operation({
          operationId: "getById",
          path: "/inventory/{itemId}",
          parameters: [
            {
              name: "itemId",
              location: "path",
              required: true,
              type: { kind: "string", nullable: false },
            },
          ],
        }),
        schemaNames,
      ),
    ).toBe("Item");
  });

  it("when aggregate cannot be inferred, then the calculation throws", () => {
    expect(() =>
      resolveAggregate(
        operation({
          operationId: "mystery",
          path: "/unknown/{value}",
        }),
        schemaNames,
      ),
    ).toThrow(/Cannot infer aggregate for operation "mystery"/);
  });
});

describe("Given operations that resolve to aggregates", () => {
  it("when grouped, then operations are collected without mutating the source list", () => {
    const createItem = operation({
      operationId: "createItem",
      method: "post",
      path: "/items",
      extension: { aggregate: "Item", action: "create" },
    });
    const getOrder = operation({
      operationId: "getOrder",
      path: "/orders/{orderId}",
      extension: { aggregate: "Order", action: "get" },
    });
    const listItems = operation({
      operationId: "listItems",
      path: "/items",
      extension: { aggregate: "Item", action: "list" },
    });
    const source = [createItem, getOrder, listItems];

    expect(groupOperationsByAggregate(source, schemaNames)).toEqual([
      ["Item", [createItem, listItems]],
      ["Order", [getOrder]],
    ]);
    expect(source).toEqual([createItem, getOrder, listItems]);
  });
});
