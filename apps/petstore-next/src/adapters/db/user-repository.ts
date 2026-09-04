import type { User } from "../../core/domain/user.ts";
import type { UserRepository } from "../../core/ports/user-repository.ts";
import { mapUserRow } from "./mappers.ts";
import { users } from "./schema.ts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDrizzleUserRepository(
  db: NodePgDatabase<Record<string, unknown>>,
): UserRepository {
  return {
    async createUser(user: User): Promise<User> {
      const [row] = await db.insert(users).values(user).returning();
      if (!row) throw new Error("Drizzle did not return the inserted user");
      return mapUserRow(row);
    },
    async createUsersWithListInput(body: Array<User>): Promise<User> {
      const rows = await db.insert(users).values(body).returning();
      const [row] = rows;
      if (!row) throw new Error("Drizzle did not return the inserted user");
      return mapUserRow(row);
    },
    async deleteUser(username: string): Promise<boolean> {
      const [row] = await db.delete(users).where(eq(users.username, username)).returning();
      return row !== undefined;
    },
    async getUserByName(username: string): Promise<User | undefined> {
      const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return row ? mapUserRow(row) : undefined;
    },
    async loginUser(): Promise<{ data: string; headers: { "x-rate-limit": number; "x-expires-after": string } }> {
      return { data: "", headers: { "x-rate-limit": 0, "x-expires-after": "" } };
    },
    async logoutUser(): Promise<void> {
      return;
    },
    async updateUser(username: string, user: User): Promise<User | undefined> {
      const [row] = await db
        .update(users)
        .set({ username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, password: user.password, phone: user.phone, userStatus: user.userStatus })
        .where(eq(users.username, username))
        .returning();
      return row ? mapUserRow(row) : undefined;
    },
  };
}
