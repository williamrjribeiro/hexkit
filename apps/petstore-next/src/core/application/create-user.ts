import type { User } from "../domain/user.ts";
import type { UserRepository } from "../ports/user-repository.ts";

export type CreateUser = (user: User) => Promise<User>;

export function createCreateUser(users: UserRepository): CreateUser {
  return (user) => users.createUser(user);
}
