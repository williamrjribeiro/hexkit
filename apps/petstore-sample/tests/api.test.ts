import { describe, expect, it } from "vite-plus/test";
import { request, spec } from "pactum";

import { createAcceptanceIds } from "./api-fixtures.ts";

const apiBaseUrl = process.env.PETSTORE_API_URL ?? "http://127.0.0.1:3000";
const goodApiKey = process.env.AUTH_API_KEYS?.split(",")[0] ?? "test-key";
const rejectedApiKey = "not-a-valid-key";
const ids = createAcceptanceIds();
const { invalidOrderId, missingPetId, orderId, petId } = ids;
const {
  filterAvailablePetId,
  filterBothTagsPetId,
  filterFriendlyPetId,
  filterPendingPetId,
  filterQuietPetId,
  filterSoldPetId,
} = ids;

const addedPet = {
  id: petId,
  name: `Hexkit dogfood pet ${String(petId)}`,
  status: "available",
  category: { id: 1, name: "Dogs" },
  photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
  tags: [{ id: 10, name: "friendly" }],
};
const updatedPet = {
  ...addedPet,
  name: `Updated Hexkit dogfood pet ${String(petId)}`,
  status: "sold",
  category: { id: 2, name: "Working Dogs" },
  photoUrls: [
    `https://example.test/pets/${String(petId)}.jpg`,
    `https://example.test/pets/${String(petId)}-2.jpg`,
  ],
  tags: [
    { id: 10, name: "friendly" },
    { id: 11, name: "trained" },
  ],
};
const minimalPet = {
  id: ids.minimalPetId,
  name: `Minimal Hexkit pet ${String(ids.minimalPetId)}`,
  photoUrls: [] as string[],
};
const categoryOnlyPet = {
  id: ids.categoryOnlyPetId,
  name: `Category-only pet ${String(ids.categoryOnlyPetId)}`,
  photoUrls: [`https://example.test/pets/${String(ids.categoryOnlyPetId)}.jpg`],
  category: { id: 3, name: "Cats" },
};
const tagsOnlyPet = {
  id: ids.tagsOnlyPetId,
  name: `Tags-only pet ${String(ids.tagsOnlyPetId)}`,
  photoUrls: [`https://example.test/pets/${String(ids.tagsOnlyPetId)}.jpg`],
  tags: [{ id: 20, name: "quiet" }],
};
const emptyTagsPet = {
  id: ids.emptyTagsPetId,
  name: `Empty-tags pet ${String(ids.emptyTagsPetId)}`,
  photoUrls: [`https://example.test/pets/${String(ids.emptyTagsPetId)}.jpg`],
  tags: [] as Array<{ id: number; name: string }>,
};
const emptyCategoryPet = {
  id: ids.emptyCategoryPetId,
  name: `Empty-category pet ${String(ids.emptyCategoryPetId)}`,
  photoUrls: [`https://example.test/pets/${String(ids.emptyCategoryPetId)}.jpg`],
  category: {},
};
const partialCategoryPet = {
  id: ids.partialCategoryPetId,
  name: `Partial-category pet ${String(ids.partialCategoryPetId)}`,
  photoUrls: [`https://example.test/pets/${String(ids.partialCategoryPetId)}.jpg`],
  category: { name: "ユニコード犬" },
};
const putOmitPet = {
  id: ids.putOmitPetId,
  name: `Put-omit pet ${String(ids.putOmitPetId)}`,
  status: "available" as const,
  category: { id: 8, name: "Keep me" },
  photoUrls: [`https://example.test/pets/${String(ids.putOmitPetId)}.jpg`],
  tags: [{ id: 30, name: "keep" }],
};
const replaceUrlsPet = {
  id: ids.replaceUrlsPetId,
  name: `Replace-urls pet ${String(ids.replaceUrlsPetId)}`,
  photoUrls: [
    `https://example.test/pets/${String(ids.replaceUrlsPetId)}.jpg`,
    `https://example.test/pets/${String(ids.replaceUrlsPetId)}-b.jpg`,
  ],
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

async function expectPersistedPet(pet: object): Promise<void> {
  await runAgainstApi(() => spec().post("/pet").withJson(pet).expectStatus(201).expectJson(pet));
  await runAgainstApi(() =>
    spec()
      .get(`/pet/${String((pet as { id: number }).id)}`)
      .withHeaders("api_key", goodApiKey)
      .expectStatus(200)
      .expectJson(pet),
  );
}

describe.sequential("Given the generated Petstore API", () => {
  describe.sequential("api_key header", () => {
    it("when GET /pet/{petId} has no api_key, then it returns 401", async () => {
      await runAgainstApi(() =>
        spec()
          .get(`/pet/${String(petId)}`)
          .expectStatus(401)
          .expectJson({ error: "Unauthorized" }),
      );
    });

    it("when GET /pet/{petId} has a rejected api_key, then it returns 401", async () => {
      await runAgainstApi(() =>
        spec()
          .get(`/pet/${String(petId)}`)
          .withHeaders("api_key", rejectedApiKey)
          .expectStatus(401)
          .expectJson({ error: "Unauthorized" }),
      );
    });
  });

  describe.sequential("nested JSONB validation", () => {
    it("when photoUrls is missing, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({ id: petId, name: "No photos" })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when photoUrls is a string, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({ id: petId, name: "Bad photos", photoUrls: "https://example.test/a.jpg" })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when photoUrls contains a non-string item, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({ id: petId, name: "Numeric photos", photoUrls: [1] })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when category is a string, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({
            id: petId,
            name: "String category",
            photoUrls: [],
            category: "Dogs",
          })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when category is null, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({
            id: petId,
            name: "Null category",
            photoUrls: [],
            category: null,
          })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when tags is an object, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({
            id: petId,
            name: "Object tags",
            photoUrls: [],
            tags: { id: 1, name: "friendly" },
          })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when tags is null, then the request is rejected", async () => {
      await runAgainstApi(() =>
        spec()
          .post("/pet")
          .withJson({
            id: petId,
            name: "Null tags",
            photoUrls: [],
            tags: null,
          })
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });
  });

  describe.sequential("nested JSONB round-trips", () => {
    it("when a Pet is added with only required nested fields, then empty photoUrls round-trip and optional nests are omitted", async () => {
      await expectPersistedPet(minimalPet);
    });

    it("when a Pet includes only category, then tags stay omitted", async () => {
      await expectPersistedPet(categoryOnlyPet);
    });

    it("when a Pet includes only tags, then category stays omitted", async () => {
      await expectPersistedPet(tagsOnlyPet);
    });

    it("when tags is an empty array, then the empty array round-trips as present", async () => {
      await expectPersistedPet(emptyTagsPet);
    });

    it("when category is an empty object, then the empty object round-trips", async () => {
      await expectPersistedPet(emptyCategoryPet);
    });

    it("when category omits optional id and uses a unicode name, then the partial object round-trips", async () => {
      await expectPersistedPet(partialCategoryPet);
    });

    it("when a later PUT omits previously stored nested fields, then JSONB values are not cleared", async () => {
      await expectPersistedPet(putOmitPet);
      const withoutNests = {
        id: putOmitPet.id,
        name: putOmitPet.name,
        photoUrls: putOmitPet.photoUrls,
      };
      await runAgainstApi(() =>
        spec().put("/pet").withJson(withoutNests).expectStatus(200).expectJson(putOmitPet),
      );
      await runAgainstApi(() =>
        spec()
          .get(`/pet/${String(putOmitPet.id)}`)
          .withHeaders("api_key", goodApiKey)
          .expectStatus(200)
          .expectJson(putOmitPet),
      );
    });

    it("when photoUrls is replaced with an empty array, then the required JSONB list clears", async () => {
      await expectPersistedPet(replaceUrlsPet);
      const cleared = { ...replaceUrlsPet, photoUrls: [] as string[] };
      await runAgainstApi(() =>
        spec().put("/pet").withJson(cleared).expectStatus(200).expectJson(cleared),
      );
      await runAgainstApi(() =>
        spec()
          .get(`/pet/${String(replaceUrlsPet.id)}`)
          .withHeaders("api_key", goodApiKey)
          .expectStatus(200)
          .expectJson(cleared),
      );
    });

    it("when a previously minimal Pet is updated with nested fields, then those JSONB values persist", async () => {
      const enriched = {
        ...minimalPet,
        category: { id: 9, name: "Added later" },
        tags: [{ id: 40, name: "new" }],
        status: "pending",
      };
      await runAgainstApi(() =>
        spec().put("/pet").withJson(enriched).expectStatus(200).expectJson(enriched),
      );
      await runAgainstApi(() =>
        spec()
          .get(`/pet/${String(minimalPet.id)}`)
          .withHeaders("api_key", goodApiKey)
          .expectStatus(200)
          .expectJson(enriched),
      );
    });
  });

  describe.sequential("Pet list filters", () => {
    const availablePet = {
      id: filterAvailablePetId,
      name: `Filter available ${String(filterAvailablePetId)}`,
      status: "available" as const,
      photoUrls: [`https://example.test/pets/${String(filterAvailablePetId)}.jpg`],
      tags: [{ id: 1, name: "friendly" }],
    };
    const pendingPet = {
      id: filterPendingPetId,
      name: `Filter pending ${String(filterPendingPetId)}`,
      status: "pending" as const,
      photoUrls: [`https://example.test/pets/${String(filterPendingPetId)}.jpg`],
    };
    const soldPet = {
      id: filterSoldPetId,
      name: `Filter sold ${String(filterSoldPetId)}`,
      status: "sold" as const,
      photoUrls: [`https://example.test/pets/${String(filterSoldPetId)}.jpg`],
    };
    const quietPet = {
      id: filterQuietPetId,
      name: `Filter quiet ${String(filterQuietPetId)}`,
      status: "available" as const,
      photoUrls: [`https://example.test/pets/${String(filterQuietPetId)}.jpg`],
      tags: [{ id: 2, name: "quiet" }],
    };
    const bothTagsPet = {
      id: filterBothTagsPetId,
      name: `Filter both-tags ${String(filterBothTagsPetId)}`,
      status: "available" as const,
      photoUrls: [`https://example.test/pets/${String(filterBothTagsPetId)}.jpg`],
      tags: [
        { id: 3, name: "friendly" },
        { id: 4, name: "quiet" },
      ],
    };

    it("seeds pets for filter queries", async () => {
      for (const pet of [availablePet, pendingPet, soldPet, quietPet, bothTagsPet]) {
        await runAgainstApi(() => spec().post("/pet").withJson(pet).expectStatus(201).expectJson(pet));
      }
    });

    it("when findPetsByStatus filters available pets, then only matches are returned", async () => {
      await runAgainstApi(async () => {
        const response = await spec()
          .get("/pet/findByStatus")
          .withQueryParams("status", "available")
          .expectStatus(200)
          .returns((ctx) => ctx.res.json as Array<{ id: number }>);
        const returnedIds = response.map((pet) => pet.id);
        expect(returnedIds).toContain(filterAvailablePetId);
        expect(returnedIds).toContain(filterQuietPetId);
        expect(returnedIds).toContain(filterBothTagsPetId);
        expect(returnedIds).not.toContain(filterPendingPetId);
        expect(returnedIds).not.toContain(filterSoldPetId);
      });
    });

    it("when findPetsByStatus receives multiple statuses, then the union is returned", async () => {
      await runAgainstApi(async () => {
        const response = await spec()
          .get("/pet/findByStatus")
          .withQueryParams("status", ["available", "sold"])
          .expectStatus(200)
          .returns((ctx) => ctx.res.json as Array<{ id: number }>);
        const returnedIds = response.map((pet) => pet.id);
        expect(returnedIds).toContain(filterAvailablePetId);
        expect(returnedIds).toContain(filterSoldPetId);
        expect(returnedIds).not.toContain(filterPendingPetId);
      });
    });

    it("when findPetsByStatus is missing status, then the API returns 400", async () => {
      await runAgainstApi(() =>
        spec()
          .get("/pet/findByStatus")
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });

    it("when findPetsByTags filters by tag name, then matching pets are returned", async () => {
      await runAgainstApi(async () => {
        const response = await spec()
          .get("/pet/findByTags")
          .withQueryParams("tags", "friendly")
          .expectStatus(200)
          .returns((ctx) => ctx.res.json as Array<{ id: number }>);
        const returnedIds = response.map((pet) => pet.id);
        expect(returnedIds).toContain(filterAvailablePetId);
        expect(returnedIds).toContain(filterBothTagsPetId);
        expect(returnedIds).not.toContain(filterQuietPetId);
      });
    });

    it("when findPetsByTags has no matches, then the API returns an empty array", async () => {
      await runAgainstApi(() =>
        spec()
          .get("/pet/findByTags")
          .withQueryParams("tags", "missing-tag")
          .expectStatus(200)
          .expectJson([]),
      );
    });

    it("when findPetsByTags is missing tags, then the API returns 400", async () => {
      await runAgainstApi(() =>
        spec()
          .get("/pet/findByTags")
          .expectStatus(400)
          .expectJson({ error: "Bad Request" }),
      );
    });
  });

  describe.sequential("Pet and Order lifecycle", () => {
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
          .withHeaders("api_key", goodApiKey)
          .expectStatus(200)
          .expectJson(updatedPet),
      );
    });

    it("when an Order references the nested Pet, then it returns the persisted Order", async () => {
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
          .withHeaders("api_key", goodApiKey)
          .expectStatus(404);
      });
    });
  });
});
