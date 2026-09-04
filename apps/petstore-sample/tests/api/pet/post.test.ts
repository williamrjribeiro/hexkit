import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, expectPersistedPet, runAgainstApi } from "../helpers.ts";

describe("POST /pet", () => {
  configurePactum();
  const ids = createAcceptanceIds();
  const { missingPetId, petId } = ids;
  const addedPet = {
    id: petId,
    name: `Hexkit dogfood pet ${String(petId)}`,
    status: "available",
    category: { id: 1, name: "Dogs" },
    photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
    tags: [{ id: 10, name: "friendly" }],
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
  });

  describe.sequential("addPet and form patches", () => {
    it("when a Pet is added, then it returns the persisted Pet", async () => {
      await runAgainstApi(() =>
        spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
      );
    });

    it("when POST /pet/{petId} patches name and status, then nested fields are preserved", async () => {
      await runAgainstApi(() =>
        spec()
          .post(`/pet/${String(petId)}`)
          .withQueryParams({ name: `Form-updated ${String(petId)}`, status: "pending" })
          .expectStatus(200)
          .expectJsonLike({
            id: petId,
            name: `Form-updated ${String(petId)}`,
            status: "pending",
            category: addedPet.category,
            photoUrls: addedPet.photoUrls,
            tags: addedPet.tags,
          }),
      );
    });

    it("when POST /pet/{petId} omits name, then the existing name is kept", async () => {
      await runAgainstApi(() =>
        spec()
          .post(`/pet/${String(petId)}`)
          .withQueryParams({ status: "sold" })
          .expectStatus(200)
          .expectJsonLike({
            id: petId,
            name: `Form-updated ${String(petId)}`,
            status: "sold",
          }),
      );
    });

    it("when POST /pet/{petId} has no query fields, then the pet is unchanged", async () => {
      await runAgainstApi(() =>
        spec()
          .post(`/pet/${String(petId)}`)
          .expectStatus(200)
          .expectJsonLike({
            id: petId,
            name: `Form-updated ${String(petId)}`,
            status: "sold",
          }),
      );
    });

    it("when POST /pet/{petId} targets a missing pet, then it returns 404", async () => {
      await runAgainstApi(() =>
        spec()
          .post(`/pet/${String(missingPetId)}`)
          .withQueryParams({ name: "nope" })
          .expectStatus(404),
      );
    });

    it("when POST /pet/{petId} has an invalid status, then it returns 400", async () => {
      await runAgainstApi(() =>
        spec()
          .post(`/pet/${String(petId)}`)
          .withQueryParams({ status: "not-a-status" })
          .expectStatus(400),
      );
    });
  });
});
