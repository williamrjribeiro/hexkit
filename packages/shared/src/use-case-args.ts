/**
 * Inputs the use-case argument calculation needs. Structural so HTTP plugins
 * can pass hexagonal use cases without `@hexkit/shared` importing hexagonal.
 */
export type UseCaseArgumentInput = {
  requiresAuth: boolean;
  parameters: readonly { readonly name: string }[];
};

/**
 * Build the generated controller argument list for a use-case invocation.
 *
 * Authenticated operations always receive `principal` first. JSON bodies use
 * `request.value.body`; otherwise each path parameter is read from
 * `request.value.path.<name>`.
 *
 * @param useCase - Auth flag and path/body parameter names.
 * @param hasJsonRequestBody - Whether the operation's request body is JSON.
 */
export function deriveUseCaseArgumentExpressions(
  useCase: UseCaseArgumentInput,
  hasJsonRequestBody: boolean,
): readonly string[] {
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  if (hasJsonRequestBody) {
    return [...principalExpression, "request.value.body"];
  }

  return [
    ...principalExpression,
    ...useCase.parameters.map((parameter) => `request.value.path.${parameter.name}`),
  ];
}
