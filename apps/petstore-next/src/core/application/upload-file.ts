import type { ApiResponse } from "../domain/api-response.ts";
import type { BlobStore } from "../ports/blob-store.ts";
import type { PetImageRepository } from "../ports/pet-image-repository.ts";

export type UploadFile = (petId: number, additionalMetadata: string | undefined, body: Uint8Array) => Promise<ApiResponse | undefined>;

export function createUploadFile(
  blobs: BlobStore,
  petImages: PetImageRepository,
): UploadFile {
  return async (petId, additionalMetadata, body) => {
    const { key } = await blobs.put(body);
    const saved = await petImages.uploadFile(petId, key, additionalMetadata);
    if (saved === undefined) return undefined;
    return { code: 200, type: "unknown", message: additionalMetadata ?? "" };
  };
}
