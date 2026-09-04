import type { User } from "../domain/user.ts";
import type { UserRepository } from "../ports/user-repository.ts";

export type GetUserByName = (username: string) => Promise<User | undefined>;

export function createGetUserByName(users: UserRepository): GetUserByName {
  return (username) => users.getUserByName(username);
}
