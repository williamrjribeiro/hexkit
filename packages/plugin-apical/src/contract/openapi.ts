import { bundle, compileErrors, validate } from "@readme/openapi-parser";

export type OpenApiLoader = (inputPath: string) => Promise<unknown>;

export const loadValidatedOpenApi: OpenApiLoader = async (inputPath) => {
  const validation = await validate(inputPath);
  if (!validation.valid) {
    throw new Error(compileErrors(validation));
  }

  return bundle(inputPath);
};
