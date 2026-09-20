import { spec } from "pactum";
import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { readBlobByPetImagePetId } from "../helpers/blob-db.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("POST /pet/{petId}/uploadImage", () => {
  configurePactum();
  const { missingPetId, petId } = createAcceptanceIds();
  const uploadBytes = Buffer.from("hexkit-upload-fixture");
  const pet = {
    id: petId,
    name: `Upload dogfood pet ${String(petId)}`,
    photoUrls: [] as string[],
  };

  it("creates the Pet used by the upload cases", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(pet).expectStatus(201).expectJson(pet),
    );
  });

  it("stores the exact uploaded bytes and returns an ApiResponse", async () => {
    await runAgainstApi(() =>
      spec()
        .post(`/pet/${String(petId)}/uploadImage`)
        .withHeaders("Content-Type", "application/octet-stream")
        .withBody(uploadBytes)
        .expectStatus(200)
        .expectJson({ code: 200, type: "unknown", message: "" }),
    );

    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl === undefined) {
      throw new Error("DATABASE_URL is required for the Petstore blob assertion");
    }
    const storedBytes = await readBlobByPetImagePetId(databaseUrl, petId);
    expect(storedBytes).toEqual(new Uint8Array(uploadBytes));
  });

  it("reflects optional additionalMetadata in the ApiResponse message", async () => {
    const additionalMetadata = "front profile";
    await runAgainstApi(() =>
      spec()
        .post(`/pet/${String(petId)}/uploadImage`)
        .withQueryParams({ additionalMetadata })
        .withHeaders("Content-Type", "application/octet-stream")
        .withBody(Buffer.from("metadata-upload"))
        .expectStatus(200)
        .expectJson({ code: 200, type: "unknown", message: additionalMetadata }),
    );
  });

  it("returns 404 for an unknown petId", async () => {
    await runAgainstApi(() =>
      spec()
        .post(`/pet/${String(missingPetId)}/uploadImage`)
        .withHeaders("Content-Type", "application/octet-stream")
        .withBody(uploadBytes)
        .expectStatus(404),
    );
  });

  it("returns 400 for an empty body", async () => {
    await runAgainstApi(() =>
      spec()
        .post(`/pet/${String(petId)}/uploadImage`)
        .withHeaders("Content-Type", "application/octet-stream")
        .withBody(Buffer.alloc(0))
        .expectStatus(400),
    );
  });
});
