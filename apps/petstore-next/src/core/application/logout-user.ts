import type { UserRepository } from "../ports/user-repository.ts";

export type LogoutUser = () => Promise<void>;

export function createLogoutUser(users: UserRepository): LogoutUser {
  return () => users.logoutUser();
}
