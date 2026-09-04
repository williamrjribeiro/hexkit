import { spec } from "pactum";
import { describe, expect, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("GET /user", () => {
  configurePactum();
  const ids = createAcceptanceIds();
  const createdUser = {
    id: ids.userId,
    username: `hexkit-user-${String(ids.userId)}`,
    firstName: "Hex",
    lastName: "Kit",
    email: `user-${String(ids.userId)}@example.test`,
    password: "unused-in-poc",
    phone: "555-0100",
    userStatus: 1,
  };
  const missingUsername = "no-such-hexkit-user";

  it("when a User is created, then it returns the persisted User", async () => {
    await runAgainstApi(() =>
      spec().post("/user").withJson(createdUser).expectStatus(201).expectJson(createdUser),
    );
  });

  it("when the User is fetched by username, then the create persisted", async () => {
    await runAgainstApi(() =>
      spec().get(`/user/${createdUser.username}`).expectStatus(200).expectJson(createdUser),
    );
  });

  it("when login query credentials are present, then the stub token and headers are returned", async () => {
    await runAgainstApi(async () => {
      const response = await spec()
        .get("/user/login")
        .withQueryParams({ username: createdUser.username, password: createdUser.password })
        .expectStatus(200)
        .expectHeader("x-rate-limit", "0")
        .expectHeader("x-expires-after", "")
        .returns((ctx) => ctx.res.json as unknown);
      expect(response).toBe("");
    });
  });

  it("when GET /user/login omits required query params, then it is loginUser (400), not getUserByName (404)", async () => {
    await runAgainstApi(() =>
      spec().get("/user/login").expectStatus(400).expectJson({ error: "Bad Request" }),
    );
  });

  it("when login omits password, then the API returns 400", async () => {
    await runAgainstApi(() =>
      spec()
        .get("/user/login")
        .withQueryParams({ username: createdUser.username })
        .expectStatus(400)
        .expectJson({ error: "Bad Request" }),
    );
  });

  it("when GET /user/logout is requested, then it is logoutUser (200), not getUserByName (404)", async () => {
    await runAgainstApi(() => spec().get("/user/logout").expectStatus(200));
  });

  it("when a missing User is fetched, then it returns 404", async () => {
    await runAgainstApi(() => spec().get(`/user/${missingUsername}`).expectStatus(404));
  });
});
