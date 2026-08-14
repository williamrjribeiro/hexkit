export type PetStatus = "available" | "pending" | "sold";

export type Pet = {
  id: number;
  name: string;
  status?: PetStatus;
};
