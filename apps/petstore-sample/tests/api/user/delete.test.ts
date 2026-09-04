import { spec } from "pactum";
import { describe, it } from "vite-plus/test";

import { createAcceptanceIds } from "../../api-fixtures.ts";
import { configurePactum, runAgainstApi } from "../helpers.ts";

describe.sequential("DELETE /user", () => {
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
  const listUserB = {
    id: ids.missingUserId,
    username: `hexkit-list-b-${String(ids.missingUserId)}`,
  };
  const missingUsername = "no-such-hexkit-user";

  it("when a User is created, then it returns the persisted User", async () => {
    await runAgainstApi(() =>
      spec().post("/user").withJson(createdUser).expectStatus(201).expectJson(createdUser),
    );
  });

  it("when another User is created, then it returns the persisted User", async () => {
    await runAgainstApi(() =>
      spec().post("/user").withJson(listUserB).expectStatus(201).expectJson(listUserB),
    );
  });

  it("when a missing User is deleted, then it returns 404", async () => {
    await runAgainstApi(() => spec().delete(`/user/${missingUsername}`).expectStatus(404));
  });

  it("when the User is deleted, then it is no longer available", async () => {
    await runAgainstApi(async () => {
      await spec().delete(`/user/${createdUser.username}`).expectStatus(204);
      await spec().get(`/user/${createdUser.username}`).expectStatus(404);
    });
  });

  it("when another User still exists after delete, then username lookup finds it", async () => {
    await runAgainstApi(() =>
      spec().get(`/user/${listUserB.username}`).expectStatus(200).expectJson(listUserB),
    );
  });
});
