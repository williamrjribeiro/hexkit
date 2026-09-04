import { spec } from "pactum";
import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, goodApiKey, rejectedApiKey, runAgainstApi } from "../helpers.ts";

describe("GET /pet", () => {
  configurePactum();
  const ids = createAcceptanceIds();
  const { petId } = ids;
  const {
    filterAvailablePetId,
    filterBothTagsPetId,
    filterPendingPetId,
    filterQuietPetId,
    filterSoldPetId,
  } = ids;

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

  it("when the Pet is fetched by id, then the create persisted", async () => {
    const addedPet = {
      id: petId,
      name: `Hexkit dogfood pet ${String(petId)}`,
      status: "available",
      category: { id: 1, name: "Dogs" },
      photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
      tags: [{ id: 10, name: "friendly" }],
    };
    await runAgainstApi(() =>
      spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
    );
    await runAgainstApi(() =>
      spec()
        .get(`/pet/${String(petId)}`)
        .withHeaders("api_key", goodApiKey)
        .expectStatus(200)
        .expectJson(addedPet),
    );
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
        await runAgainstApi(() =>
          spec().post("/pet").withJson(pet).expectStatus(201).expectJson(pet),
        );
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
        spec().get("/pet/findByStatus").expectStatus(400).expectJson({ error: "Bad Request" }),
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
        spec().get("/pet/findByTags").expectStatus(400).expectJson({ error: "Bad Request" }),
      );
    });
  });
});
