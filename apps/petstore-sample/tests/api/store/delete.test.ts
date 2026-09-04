import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("DELETE /store", () => {
  configurePactum();
  const { orderId, petId } = createAcceptanceIds();
  const addedPet = {
    id: petId,
    name: `Hexkit dogfood pet ${String(petId)}`,
    status: "available",
    category: { id: 1, name: "Dogs" },
    photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
    tags: [{ id: 10, name: "friendly" }],
  };
  const placedOrder = {
    id: orderId,
    petId,
    quantity: 2,
    status: "placed",
    complete: false,
  };

  it("when a Pet is added, then it returns the persisted Pet", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
    );
  });

  it("when an Order references the nested Pet, then it returns the persisted Order", async () => {
    await runAgainstApi(() =>
      spec().post("/store/order").withJson(placedOrder).expectStatus(201).expectJson(placedOrder),
    );
  });

  it("when the Order is deleted, then it is no longer available", async () => {
    await runAgainstApi(async () => {
      await spec()
        .delete(`/store/order/${String(orderId)}`)
        .expectStatus(204);
      await spec()
        .get(`/store/order/${String(orderId)}`)
        .expectStatus(404);
    });
  });
});
