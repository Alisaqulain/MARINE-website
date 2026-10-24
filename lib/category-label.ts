export type NamedCategory = {
  slug: string;
  name: string;
  children?: NamedCategory[];
};

/** Name from the live category tree, including admin renames. */
export function findNamedCategory(nodes: NamedCategory[] | undefined, slug: string | null): string | null {
  if (!slug || !nodes?.length) return null;
  for (const node of nodes) {
    if (node.slug === slug) return node.name;
    const nested = findNamedCategory(node.children, slug);
    if (nested) return nested;
  }
  return null;
}
