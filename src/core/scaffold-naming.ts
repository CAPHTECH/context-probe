export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function toPascalCase(value: string): string {
  const normalized = value
    .replace(/\.[^.]+$/u, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim();
  if (!normalized) {
    return "Generated";
  }
  return normalized
    .split(/\s+/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

export function makeUniqueNames(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name) => {
    const count = counts.get(name) ?? 0;
    counts.set(name, count + 1);
    if (count === 0) {
      return name;
    }
    return `${name}${count + 1}`;
  });
}
