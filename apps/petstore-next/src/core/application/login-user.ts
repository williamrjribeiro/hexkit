import type { UserRepository } from "../ports/user-repository.ts";

export type LoginUser = (username: string, password: string) => Promise<{ data: string; headers: { "x-rate-limit": number; "x-expires-after": string } }>;

export function createLoginUser(users: UserRepository): LoginUser {
  return (username, password) => users.loginUser(username, password);
}
