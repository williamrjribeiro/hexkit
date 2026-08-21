import { describe, expect, it } from "vite-plus/test";

import { deriveDomainEntity } from "./entity.ts";

describe("Given a schema with nested references", () => {
  it("when the entity references itself, then the self name is omitted from imports", () => {
    const entity = deriveDomainEntity({
      name: "Node",
      modulePath: "schemas/Node.ts",
      properties: [
        {
          name: "id",
          required: true,
          type: { kind: "string", nullable: false },
        },
        {
          name: "child",
          required: false,
          type: { kind: "reference", nullable: false, schema: "Node" },
        },
        {
          name: "label",
          required: true,
          type: { kind: "reference", nullable: false, schema: "Caption" },
        },
      ],
    });

    expect(entity.filePath).toBe("src/core/domain/node.ts");
    expect(entity.referencedSchemas).toEqual(["Caption"]);
    expect(entity.properties.map((property) => property.name)).toEqual(["id", "child", "label"]);
  });

  it("when a property is an enum, then an entity alias is collected", () => {
    const entity = deriveDomainEntity({
      name: "Ticket",
      modulePath: "schemas/Ticket.ts",
      properties: [
        {
          name: "status",
          required: true,
          type: { kind: "string", nullable: false, enum: ["open", "closed"] },
        },
      ],
    });

    expect(entity.enumAliases).toEqual([{ name: "TicketStatus", values: ["open", "closed"] }]);
    expect(entity.properties[0]?.typeExpression).toBe("TicketStatus");
  });
});
