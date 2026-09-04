import { request, spec } from "pactum";

export const apiBaseUrl = process.env.PETSTORE_API_URL ?? "http://127.0.0.1:3000";
export const goodApiKey = process.env.AUTH_API_KEYS?.split(",")[0] ?? "test-key";
export const rejectedApiKey = "not-a-valid-key";

export function configurePactum(): void {
  request.setBaseUrl(apiBaseUrl);
  request.setDefaultTimeout(2_000);
}

export async function runAgainstApi(assertion: () => unknown): Promise<void> {
  try {
    await assertion();
  } catch (error) {
    throw new Error(
      `Petstore acceptance request failed against ${apiBaseUrl}. Ensure the generated Compose stack is running. ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

export async function expectPersistedPet(pet: object): Promise<void> {
  await runAgainstApi(() => spec().post("/pet").withJson(pet).expectStatus(201).expectJson(pet));
  await runAgainstApi(() =>
    spec()
      .get(`/pet/${String((pet as { id: number }).id)}`)
      .withHeaders("api_key", goodApiKey)
      .expectStatus(200)
      .expectJson(pet),
  );
}
