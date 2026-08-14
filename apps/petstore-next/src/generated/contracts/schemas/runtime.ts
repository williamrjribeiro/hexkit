import * as z from 'zod';

/*
 * Validates that exactly one schema in the union matches the input.
 * Provides oneOf (exclusive union) semantics on top of z.union.
 */
export function exclusiveUnion<T extends [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]>(schemas: T) {
  return z.union(schemas).superRefine((x, ctx) => {
    const errors: z.ZodError[] = [];
    for (const schema of schemas) {
      const result = schema.safeParse(x);
      if (result.error) {
        errors.push(result.error);
      }
    }
    if (schemas.length - errors.length !== 1) {
      ctx.addIssue({
        code: "invalid_union",
        errors: errors.map(error => error.issues),
        message: "Invalid input: Should pass exactly one schema",
      });
    }
  });
}
