export type BlobPutResult = { key: string };

export type BlobStore = {
  put(bytes: Uint8Array): Promise<BlobPutResult>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<boolean>;
};
