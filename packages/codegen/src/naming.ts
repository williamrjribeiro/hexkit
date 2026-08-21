export function toPascalCase(value: string): string {
  const words = splitIdentifier(value);
  return words.map(capitalize).join("");
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.length === 0 ? pascal : `${pascal[0]!.toLowerCase()}${pascal.slice(1)}`;
}

export function toKebabCase(value: string): string {
  return splitIdentifier(value).join("-");
}

export function toSnakeCase(value: string): string {
  return splitIdentifier(value).join("_");
}

export function pluralizeCamelCase(value: string): string {
  const camel = toCamelCase(value);
  if (camel.length === 0) return camel;
  return camel.endsWith("s") ? `${camel}es` : `${camel}s`;
}

export function splitIdentifier(value: string): readonly string[] {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase());
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0]!.toUpperCase()}${value.slice(1)}`;
}
