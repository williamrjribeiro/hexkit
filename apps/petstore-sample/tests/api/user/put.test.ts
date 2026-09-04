import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("PUT /user", () => {
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
  const updatedUser = {
    ...createdUser,
    firstName: "Updated",
    userStatus: 2,
  };
  const missingUsername = "no-such-hexkit-user";

  it("when a User is created, then it returns the persisted User", async () => {
    await runAgainstApi(() =>
      spec().post("/user").withJson(createdUser).expectStatus(201).expectJson(createdUser),
    );
  });

  it("when the User is updated by username, then path identity and body persist", async () => {
    await runAgainstApi(() =>
      spec()
        .put(`/user/${createdUser.username}`)
        .withJson(updatedUser)
        .expectStatus(200)
        .expectJson(updatedUser),
    );
  });

  it("when the updated User is fetched by username, then the path-keyed write persisted", async () => {
    await runAgainstApi(() =>
      spec().get(`/user/${createdUser.username}`).expectStatus(200).expectJson(updatedUser),
    );
  });

  it("when a missing User is updated, then it returns 404", async () => {
    await runAgainstApi(() =>
      spec()
        .put(`/user/${missingUsername}`)
        .withJson({ ...createdUser, username: missingUsername })
        .expectStatus(404),
    );
  });
});
