/**
 * Inputs the use-case argument calculation needs. Structural so HTTP plugins
 * can pass hexagonal use cases without `@hexkit/shared` importing hexagonal.
 */
export type UseCaseArgumentInput = {
  requiresAuth: boolean;
  parameters: readonly {
    readonly name: string;
    readonly location?: "path" | "query" | "contentType" | "body";
  }[];
};

export type UseCaseArgumentBodyFlags = {
  hasJsonRequestBody: boolean;
  hasBinaryRequestBody: boolean;
};

/**
 * Build the generated controller argument list for a use-case invocation.
 *
 * Authenticated operations always receive `principal` first. Path parameters
 * are read from `request.value.path.<name>` and query parameters from
 * `request.value.query?.<name>` (optional chaining: Apical marks the query
 * object optional when every query field is optional). JSON bodies append the
 * parsed body directly; binary bodies append the validated content type before
 * converting Apical's validated `Blob` to the `Uint8Array` expected by the
 * application port.
 *
 * @param useCase - Auth flag and path/body parameter names.
 * @param bodyFlags - Whether the operation's request body is JSON or binary.
 */
export function deriveUseCaseArgumentExpressions(
  useCase: UseCaseArgumentInput,
  bodyFlags: UseCaseArgumentBodyFlags,
): readonly string[] {
  const { hasJsonRequestBody, hasBinaryRequestBody } = bodyFlags;
  const hasRequestBody = hasJsonRequestBody || hasBinaryRequestBody;
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  const pathExpressions = useCase.parameters
    .filter((parameter) =>
      hasRequestBody ? parameter.location === "path" : parameter.location !== "query",
    )
    .map((parameter) => `request.value.path.${parameter.name}`);
  const queryExpressions = useCase.parameters
    .filter((parameter) => parameter.location === "query")
    .map((parameter) => `request.value.query?.${parameter.name}`);
  const bodyExpressions = hasBinaryRequestBody
    ? ["apicalRequest.contentType!", "new Uint8Array(await request.value.body.arrayBuffer())"]
    : hasJsonRequestBody
      ? ["request.value.body"]
      : [];

  return [...principalExpression, ...pathExpressions, ...queryExpressions, ...bodyExpressions];
}
