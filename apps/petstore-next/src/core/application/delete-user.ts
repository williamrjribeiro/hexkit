import type { UserRepository } from "../ports/user-repository.ts";

export type DeleteUser = (username: string) => Promise<boolean>;

export function createDeleteUser(users: UserRepository): DeleteUser {
  return (username) => users.deleteUser(username);
}
