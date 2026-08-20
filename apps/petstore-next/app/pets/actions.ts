"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getServerAccess } from "@/adapters/http-next/server-access";

const petStatuses = ["available", "pending", "sold"] as const;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredInteger(formData: FormData, name: string): number {
  const value = Number(readText(formData, name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readPet(formData: FormData) {
  const status = readText(formData, "status");
  if (!petStatuses.includes(status as (typeof petStatuses)[number])) {
    throw new Error("status must be available, pending, or sold.");
  }
  const name = readText(formData, "name");
  if (name.length === 0) {
    throw new Error("name is required.");
  }

  return {
    id: readRequiredInteger(formData, "id"),
    name,
    status: status as (typeof petStatuses)[number],
    photoUrls: String(formData.get("photoUrls") ?? "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
  };
}

export async function addPetAction(formData: FormData) {
  const pet = await getServerAccess().addPet(readPet(formData));
  revalidatePath("/");
  revalidatePath("/pets");
  redirect(`/pets/${pet.id}`);
}

export async function updatePetAction(formData: FormData) {
  const pet = await getServerAccess().updatePet(readPet(formData));
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${pet.id}`);
  redirect(`/pets/${pet.id}`);
}

export async function deletePetAction(formData: FormData) {
  const petId = readRequiredInteger(formData, "petId");
  await getServerAccess().deletePet(petId);
  revalidatePath("/");
  revalidatePath("/pets");
  redirect("/pets");
}

export async function viewPetAction(formData: FormData) {
  const petId = readRequiredInteger(formData, "petId");
  await getServerAccess().getPetById(petId);
  redirect(`/pets/${petId}`);
}
