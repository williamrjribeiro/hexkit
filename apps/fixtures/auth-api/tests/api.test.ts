import { describe, it } from "vite-plus/test";
import { request, spec } from "pactum";

const apiBaseUrl = process.env.AUTH_API_URL ?? "http://127.0.0.1:3000";
const goodBearer = process.env.AUTH_BEARER_TOKENS?.split(",")[0] ?? "test-token";
const badBearer = "not-a-valid-token";
const goodApiKey = process.env.AUTH_API_KEYS?.split(",")[0] ?? "test-key";

const createdItem = {
  id: "item-1",
  name: "Auth dogfood item",
};

request.setBaseUrl(apiBaseUrl);
request.setDefaultTimeout(2_000);

async function runAgainstApi(assertion: () => unknown): Promise<void> {
  try {
    await assertion();
  } catch (error) {
    throw new Error(
      `Auth API acceptance request failed against ${apiBaseUrl}. Ensure the generated Compose stack is running. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

describe.sequential("Given the generated Auth API fixture", () => {
  it("when GET /health has no auth, then it returns 200", async () => {
    await runAgainstApi(() => spec().get("/health").expectStatus(200).expectJson({ ok: true }));
  });

  it("when GET /items has no Authorization, then it returns 401", async () => {
    await runAgainstApi(() =>
      spec().get("/items").expectStatus(401).expectJson({ error: "Unauthorized" }),
    );
  });

  it("when GET /items has a valid Bearer token, then it returns 200", async () => {
    await runAgainstApi(() =>
      spec()
        .get("/items")
        .withHeaders("Authorization", `Bearer ${goodBearer}`)
        .expectStatus(200)
        .expectJson([]),
    );
  });

  it("when GET /items has an invalid Bearer token, then it returns 401", async () => {
    await runAgainstApi(() =>
      spec()
        .get("/items")
        .withHeaders("Authorization", `Bearer ${badBearer}`)
        .expectStatus(401)
        .expectJson({ error: "Unauthorized" }),
    );
  });

  it("when POST /items uses only bearer auth, then it returns 401", async () => {
    await runAgainstApi(() =>
      spec()
        .post("/items")
        .withHeaders("Authorization", `Bearer ${goodBearer}`)
        .withJson(createdItem)
        .expectStatus(401)
        .expectJson({ error: "Unauthorized" }),
    );
  });

  it("when POST /items uses a valid X-API-Key, then it returns 201", async () => {
    await runAgainstApi(() =>
      spec()
        .post("/items")
        .withHeaders("X-API-Key", goodApiKey)
        .withJson(createdItem)
        .expectStatus(201)
        .expectJson(createdItem),
    );
  });
});
