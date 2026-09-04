import type { User } from "../domain/user.ts";

export interface UserRepository {
  createUser(user: User): Promise<User>;
  createUsersWithListInput(body: Array<User>): Promise<User>;
  deleteUser(username: string): Promise<boolean>;
  getUserByName(username: string): Promise<User | undefined>;
  loginUser(username: string, password: string): Promise<{ data: string; headers: { "x-rate-limit": number; "x-expires-after": string } }>;
  logoutUser(): Promise<void>;
  updateUser(username: string, user: User): Promise<User | undefined>;
}
