import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, goodApiKey, runAgainstApi } from "../helpers.ts";

describe.sequential("DELETE /pet", () => {
  configurePactum();
  const { petId } = createAcceptanceIds();
  const addedPet = {
    id: petId,
    name: `Hexkit dogfood pet ${String(petId)}`,
    status: "available",
    category: { id: 1, name: "Dogs" },
    photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
    tags: [{ id: 10, name: "friendly" }],
  };

  it("when a Pet is added, then it returns the persisted Pet", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
    );
  });

  it("when the Pet is deleted, then it is no longer available", async () => {
    await runAgainstApi(async () => {
      await spec()
        .delete(`/pet/${String(petId)}`)
        .expectStatus(204);
      await spec()
        .get(`/pet/${String(petId)}`)
        .withHeaders("api_key", goodApiKey)
        .expectStatus(404);
    });
  });
});
