import type { User } from "../domain/user.ts";
import type { UserRepository } from "../ports/user-repository.ts";

export type UpdateUser = (username: string, user: User) => Promise<User | undefined>;

export function createUpdateUser(users: UserRepository): UpdateUser {
  return (username, user) => users.updateUser(username, user);
}
