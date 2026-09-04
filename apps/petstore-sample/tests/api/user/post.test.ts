import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("POST /user", () => {
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
  const listUserA = {
    id: ids.listUserId,
    username: `hexkit-list-${String(ids.listUserId)}`,
    email: `list-${String(ids.listUserId)}@example.test`,
  };
  const listUserB = {
    id: ids.missingUserId,
    username: `hexkit-list-b-${String(ids.missingUserId)}`,
  };
  const listUsers = [listUserA, listUserB];

  it("when a User is created, then it returns the persisted User", async () => {
    await runAgainstApi(() =>
      spec().post("/user").withJson(createdUser).expectStatus(201).expectJson(createdUser),
    );
  });

  it("when Users are created from a list, then the first persisted User is returned", async () => {
    await runAgainstApi(() =>
      spec()
        .post("/user/createWithList")
        .withJson(listUsers)
        .expectStatus(200)
        .expectJson(listUserA),
    );
  });

  it("when list Users are fetched by username, then every inserted row persisted", async () => {
    await runAgainstApi(() =>
      spec().get(`/user/${listUserA.username}`).expectStatus(200).expectJson(listUserA),
    );
    await runAgainstApi(() =>
      spec().get(`/user/${listUserB.username}`).expectStatus(200).expectJson(listUserB),
    );
  });
});
