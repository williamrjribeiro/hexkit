import type { User } from "../domain/user.ts";
import type { UserRepository } from "../ports/user-repository.ts";

export type CreateUsersWithListInput = (body: Array<User>) => Promise<User>;

export function createCreateUsersWithListInput(users: UserRepository): CreateUsersWithListInput {
  return (body) => users.createUsersWithListInput(body);
}
