/**
 * True when a media type names XML (`application/xml`, optionally with
 * parameters such as `; charset=utf-8`), compared case-insensitively.
 *
 * @param mediaType - Raw OpenAPI media type string.
 */
export function isXmlMediaType(mediaType: string): boolean {
  return mediaType.split(";", 1)[0]?.trim().toLowerCase() === "application/xml";
}
