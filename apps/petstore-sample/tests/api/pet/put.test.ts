import { XMLParser } from "fast-xml-parser";
import { spec } from "pactum";
import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, expectPersistedPet, goodApiKey, runAgainstApi } from "../helpers.ts";

describe.sequential("PUT /pet", () => {
  configurePactum();
  const ids = createAcceptanceIds();
  const { petId } = ids;
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
    await expectPersistedPet(minimalPet);
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

  it("when the Pet is updated, then it returns the persisted changes", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(addedPet).expectStatus(201).expectJson(addedPet),
    );
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

  it("when a Pet is replaced with an application/xml body, then it round-trips over Accept application/xml", async () => {
    const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });
    const seedPhotoUrl = `https://example.test/pets/${String(ids.xmlPutPetId)}.jpg`;
    const seedSecondPhotoUrl = `https://example.test/pets/${String(ids.xmlPutPetId)}-2.jpg`;
    const xmlSeedPet = {
      id: ids.xmlPutPetId,
      name: `XML-seeded pet ${String(ids.xmlPutPetId)}`,
      photoUrls: [seedPhotoUrl, seedSecondPhotoUrl],
    };
    const xmlUpdatedPet = {
      id: ids.xmlPutPetId,
      name: `XML-updated pet ${String(ids.xmlPutPetId)}`,
      status: "sold",
      category: { id: 7, name: "Working Cats" },
      photoUrls: [seedPhotoUrl, seedSecondPhotoUrl],
      tags: [
        { id: 60, name: "xml" },
        { id: 61, name: "round-trip" },
      ],
    };
    const xmlUpdateBody = [
      "<Pet>",
      `  <id>${String(xmlUpdatedPet.id)}</id>`,
      `  <name>${xmlUpdatedPet.name}</name>`,
      "  <status>sold</status>",
      "  <category>",
      "    <id>7</id>",
      "    <name>Working Cats</name>",
      "  </category>",
      `  <photoUrls>${seedPhotoUrl}</photoUrls>`,
      `  <photoUrls>${seedSecondPhotoUrl}</photoUrls>`,
      "  <tags><id>60</id><name>xml</name></tags>",
      "  <tags><id>61</id><name>round-trip</name></tags>",
      "</Pet>",
    ].join("\n");

    await runAgainstApi(() =>
      spec().post("/pet").withJson(xmlSeedPet).expectStatus(201).expectJson(xmlSeedPet),
    );
    await runAgainstApi(async () => {
      const responseBody = await spec()
        .put("/pet")
        .withHeaders("Content-Type", "application/xml")
        .withHeaders("Accept", "application/xml")
        .withBody(xmlUpdateBody)
        .expectStatus(200)
        .expectHeader("content-type", "application/xml")
        .returns((ctx) => ctx.res.text as string);
      expect(xmlParser.parse(responseBody)).toEqual({ Pet: xmlUpdatedPet });
    });
    await runAgainstApi(() =>
      spec()
        .get(`/pet/${String(xmlSeedPet.id)}`)
        .withHeaders("api_key", goodApiKey)
        .expectStatus(200)
        .expectJson(xmlUpdatedPet),
    );
  });
});
