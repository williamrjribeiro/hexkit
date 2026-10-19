import { spec } from "pactum";
import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, goodApiKey, rejectedApiKey, runAgainstApi } from "../helpers.ts";

type InventoryCounts = Record<string, number>;

function bucket(inventory: InventoryCounts, status: string): number {
  return inventory[status] ?? 0;
}

describe.sequential("GET /store/inventory", () => {
  configurePactum();
  const { inventoryAvailablePetId, inventorySoldPetId } = createAcceptanceIds();
  const availablePet = {
    id: inventoryAvailablePetId,
    name: `Hexkit dogfood inventory pet ${String(inventoryAvailablePetId)}`,
    status: "available",
    category: { id: 1, name: "Dogs" },
    photoUrls: [`https://example.test/pets/${String(inventoryAvailablePetId)}.jpg`],
    tags: [{ id: 10, name: "friendly" }],
  };
  const soldPet = {
    id: inventorySoldPetId,
    name: `Hexkit dogfood inventory pet ${String(inventorySoldPetId)}`,
    status: "sold",
    category: { id: 1, name: "Dogs" },
    photoUrls: [`https://example.test/pets/${String(inventorySoldPetId)}.jpg`],
    tags: [{ id: 10, name: "friendly" }],
  };

  describe("api_key header", () => {
    it("when GET /store/inventory has no api_key, then it returns 401", async () => {
      await runAgainstApi(() =>
        spec().get("/store/inventory").expectStatus(401).expectJson({ error: "Unauthorized" }),
      );
    });

    it("when GET /store/inventory has a rejected api_key, then it returns 401", async () => {
      await runAgainstApi(() =>
        spec()
          .get("/store/inventory")
          .withHeaders("api_key", rejectedApiKey)
          .expectStatus(401)
          .expectJson({ error: "Unauthorized" }),
      );
    });
  });

  it("when inventory is counted, then status buckets count up", async () => {
    await runAgainstApi(async () => {
      const before = await spec()
        .get("/store/inventory")
        .withHeaders("api_key", goodApiKey)
        .expectStatus(200)
        .returns((ctx) => ctx.res.json as InventoryCounts);

      await spec().post("/pet").withJson(availablePet).expectStatus(201).expectJson(availablePet);
      await spec().post("/pet").withJson(soldPet).expectStatus(201).expectJson(soldPet);

      const after = await spec()
        .get("/store/inventory")
        .withHeaders("api_key", goodApiKey)
        .expectStatus(200)
        .returns((ctx) => ctx.res.json as InventoryCounts);

      expect(bucket(after, "available") - bucket(before, "available")).toBe(1);
      expect(bucket(after, "sold") - bucket(before, "sold")).toBe(1);
      expect(bucket(after, "pending")).toBe(bucket(before, "pending"));
    });
  });
});
