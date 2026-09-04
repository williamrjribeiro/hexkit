import { describe, expect, it } from "vite-plus/test";

import { renderDomainFile } from "./domain.ts";
import { renderRepositoryFile } from "./repository.ts";
import { renderUseCaseFile } from "./use-case.ts";

describe("renderDomainFile", () => {
  it("sorts duplicate referenced schemas stably via compareText equality", () => {
    const file = renderDomainFile({
      name: "Widget",
      exportName: "Widget",
      filePath: "src/core/domain/widget.ts",
      enumAliases: [],
      properties: [
        { name: "left", required: true, typeExpression: "Part" },
        { name: "right", required: true, typeExpression: "Part" },
      ],
      referencedSchemas: ["Part", "Part", "Accessory"],
    });

    expect(file.contents).toContain('import type { Accessory } from "./accessory.ts";');
    expect(file.contents).toContain('import type { Part } from "./part.ts";');
    expect(file.contents.indexOf("Accessory")).toBeLessThan(file.contents.indexOf("Part"));
  });
});

describe("renderRepositoryFile", () => {
  it("imports multiple referenced schemas in sorted order", () => {
    const file = renderRepositoryFile({
      aggregate: "Order",
      name: "OrderRepository",
      filePath: "src/core/ports/order-repository.ts",
      parameterName: "orders",
      methods: [
        {
          operationId: "link",
          name: "link",
          action: "link",
          parameters: [
            { name: "pet", typeExpression: "Pet" },
            { name: "tag", typeExpression: "Tag" },
          ],
          returnTypeExpression: "Order",
          resultCardinality: "one",
          persistenceKind: "insert",
          referencedSchemas: ["Tag", "Pet", "Order", "Pet"],
          successHeaders: [],
        },
      ],
    });

    expect(file.contents).toMatchInlineSnapshot(`
      "import type { Order } from "../domain/order.ts";
      import type { Pet } from "../domain/pet.ts";
      import type { Tag } from "../domain/tag.ts";

      export interface OrderRepository {
        link(pet: Pet, tag: Tag): Promise<Order>;
      }
      "
    `);
  });
});

describe("renderUseCaseFile", () => {
  it("imports multiple referenced schemas in sorted order", () => {
    const file = renderUseCaseFile({
      operationId: "compose",
      typeName: "Compose",
      factoryName: "createCompose",
      filePath: "src/core/application/compose.ts",
      aggregate: "Order",
      repositoryName: "OrderRepository",
      repositoryParameterName: "orders",
      methodName: "compose",
      requiresAuth: false,
      parameters: [
        { name: "pet", typeExpression: "Pet" },
        { name: "tag", typeExpression: "Tag" },
      ],
      returnTypeExpression: "Order",
      referencedSchemas: ["Tag", "Order", "Pet", "Order"],
    });

    expect(file.contents).toMatchInlineSnapshot(`
      "import type { Order } from "../domain/order.ts";
      import type { Pet } from "../domain/pet.ts";
      import type { Tag } from "../domain/tag.ts";
      import type { OrderRepository } from "../ports/order-repository.ts";

      export type Compose = (pet: Pet, tag: Tag) => Promise<Order>;

      export function createCompose(orders: OrderRepository): Compose {
        return (pet, tag) => orders.compose(pet, tag);
      }
      "
    `);
  });
});
