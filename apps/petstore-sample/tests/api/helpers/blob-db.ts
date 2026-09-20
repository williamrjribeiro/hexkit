import pg from "pg";

export async function readBlobByPetImagePetId(
  databaseUrl: string,
  petId: number,
): Promise<Uint8Array | undefined> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const metadata = await client.query(
      "select storage_key from pet_images where pet_id = $1 order by id desc limit 1",
      [petId],
    );
    const storageKey = metadata.rows[0]?.storage_key as string | undefined;
    if (storageKey === undefined) return undefined;

    const blob = await client.query("select content from hexkit_blobs where key = $1", [
      storageKey,
    ]);
    const content = blob.rows[0]?.content as Buffer | undefined;
    return content === undefined ? undefined : new Uint8Array(content);
  } finally {
    await client.end();
  }
}
