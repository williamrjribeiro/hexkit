/**
 * Inputs the use-case argument calculation needs. Structural so HTTP plugins
 * can pass hexagonal use cases without `@hexkit/shared` importing hexagonal.
 */
export type UseCaseArgumentInput = {
  requiresAuth: boolean;
  parameters: readonly { readonly name: string; readonly location?: "path" | "query" }[];
};

/**
 * Build the generated controller argument list for a use-case invocation.
 *
 * Authenticated operations always receive `principal` first. Path parameters
 * are read from `request.value.path.<name>` and query parameters from
 * `request.value.query?.<name>` (optional chaining: Apical marks the query
 * object optional when every query field is optional). JSON bodies append
 * `request.value.body` after path and query arguments so keyed updates keep
 * the path identity.
 *
 * @param useCase - Auth flag and path/body parameter names.
 * @param hasJsonRequestBody - Whether the operation's request body is JSON.
 */
export function deriveUseCaseArgumentExpressions(
  useCase: UseCaseArgumentInput,
  hasJsonRequestBody: boolean,
): readonly string[] {
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  const pathExpressions = useCase.parameters
    .filter((parameter) =>
      hasJsonRequestBody ? parameter.location === "path" : parameter.location !== "query",
    )
    .map((parameter) => `request.value.path.${parameter.name}`);
  const queryExpressions = useCase.parameters
    .filter((parameter) => parameter.location === "query")
    .map((parameter) => `request.value.query?.${parameter.name}`);
  const bodyExpression = hasJsonRequestBody ? ["request.value.body"] : [];

  return [...principalExpression, ...pathExpressions, ...queryExpressions, ...bodyExpression];
}
