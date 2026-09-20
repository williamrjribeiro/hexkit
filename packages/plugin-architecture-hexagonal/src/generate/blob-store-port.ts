import type { GeneratedFile } from "@hexkit/plugin-api";

export function renderBlobStorePortFile(): GeneratedFile {
  return {
    path: "src/core/ports/blob-store.ts",
    ownership: "generated",
    contents: `export type BlobPutResult = { key: string };

export type BlobStore = {
  put(bytes: Uint8Array): Promise<BlobPutResult>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<boolean>;
};
`,
  };
}
