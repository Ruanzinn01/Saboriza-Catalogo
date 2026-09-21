const collator = new Intl.Collator("pt-BR");

export function normalizeCategoryName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

export function categoryKey(name: string): string {
  return normalizeCategoryName(name).toLocaleLowerCase("pt-BR");
}

export function mergeCategoryNames(registered: string[], usedByMaterials: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const name of [...registered, ...usedByMaterials]) {
    const clean = normalizeCategoryName(name);
    if (clean && !byKey.has(categoryKey(clean))) byKey.set(categoryKey(clean), clean);
  }
  return [...byKey.values()].sort((a, b) => collator.compare(a, b));
}

export function findCategoryName(names: string[], input: string): string | null {
  const key = categoryKey(input);
  return key ? (names.find((name) => categoryKey(name) === key) ?? null) : null;
}
