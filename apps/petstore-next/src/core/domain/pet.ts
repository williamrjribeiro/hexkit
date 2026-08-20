import type { Category } from "./category.ts";
import type { Tag } from "./tag.ts";

export type PetStatus = "available" | "pending" | "sold";

export type Pet = {
  id: number;
  name: string;
  status?: PetStatus;
  category?: Category;
  photoUrls: Array<string>;
  tags?: Array<Tag>;
};
