/**
 * Returns true when `status` is a 2xx HTTP status code written as a three-digit
 * string (for example `"200"` or `"204"`).
 *
 * OpenAPI response maps keep statuses as strings, including values such as
 * `"default"` that must not count as success.
 *
 * @param status - Response status from a `ContractResponse`.
 */
export function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}
