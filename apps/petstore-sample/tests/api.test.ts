import { describe, it } from "vite-plus/test";
import { request, spec } from "pactum";

import { createAcceptanceIds } from "./api-fixtures.ts";

const apiBaseUrl = process.env.PETSTORE_API_URL ?? "http://127.0.0.1:3000";
const { invalidOrderId, missingPetId, orderId, petId } = createAcceptanceIds();

const addedPet = {
  id: petId,
  name: `Hexkit dogfood pet ${String(petId)}`,
  status: "available",
};
const updatedPet = {
  ...addedPet,
  name: `Updated Hexkit dogfood pet ${String(petId)}`,
  status: "sold",
};
const placedOrder = {
  id: orderId,
  petId,
  quantity: 2,
  status: "placed",
  complete: false,
};

request.setBaseUrl(apiBaseUrl);
request.setDefaultTimeout(2_000);

async function runAgainstApi(assertion: () => unknown): Promise<void> {
  try {
    await assertion();
  } catch (error) {
    throw new Error(
      `Petstore acceptance request failed against ${apiBaseUrl}. Ensure the generated Compose stack is running. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

describe.sequential("Given the generated Petstore API", () => {
  it("when a Pet is added, then it returns the persisted Pet", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
    );
  });

  it("when the Pet is updated, then it returns the persisted changes", async () => {
    await runAgainstApi(() =>
      spec().put("/pet").withJson(updatedPet).expectStatus(200).expectJson(updatedPet),
    );
  });

  it("when the Pet is fetched by id, then the update persisted", async () => {
    await runAgainstApi(() =>
      spec()
        .get(`/pet/${String(petId)}`)
        .expectStatus(200)
        .expectJson(updatedPet),
    );
  });

  it("when an Order references the Pet, then it returns the persisted Order", async () => {
    await runAgainstApi(() =>
      spec().post("/store/order").withJson(placedOrder).expectStatus(201).expectJson(placedOrder),
    );
  });

  it("when the Order is fetched by id, then its Pet relation persisted", async () => {
    await runAgainstApi(() =>
      spec()
        .get(`/store/order/${String(orderId)}`)
        .expectStatus(200)
        .expectJson(placedOrder),
    );
  });

  it("when an Order references a missing Pet, then the relation is rejected", async () => {
    await runAgainstApi(() =>
      spec()
        .post("/store/order")
        .withJson({
          ...placedOrder,
          id: invalidOrderId,
          petId: missingPetId,
        })
        .expectStatus(500)
        .expectJson({ error: "Internal Server Error" }),
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

  it("when the Pet is deleted, then it is no longer available", async () => {
    await runAgainstApi(async () => {
      await spec()
        .delete(`/pet/${String(petId)}`)
        .expectStatus(204);
      await spec()
        .get(`/pet/${String(petId)}`)
        .expectStatus(404);
    });
  });
});
