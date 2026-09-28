/**
 * Department ID rule per SPEC §3 / §5:
 * lowercase, trim, & → and, any run of non-alphanumerics → -, strip leading/trailing -
 * e.g. "Computer Science" → "computer-science"
 */
export function toDepartmentId(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns all candidate representations of a department identifier/name
 * (e.g. "computer-science", "Computer Science", "Computer Science - BYC").
 * Used to ensure seamless compatibility across Firestore activityState,
 * roster records, and UI views.
 */
export function getDepartmentVariants(raw: string): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  const slug = toDepartmentId(trimmed);
  const variants = new Set<string>();

  if (trimmed) variants.add(trimmed);
  if (slug) variants.add(slug);

  // Common title-case name from slug (e.g. "computer-science" -> "Computer Science")
  if (slug) {
    const titleCase = slug
      .replace(/-byc$/, '')
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    if (titleCase) variants.add(titleCase);

    const slugNoByc = slug.replace(/-byc$/, '');
    if (slugNoByc) variants.add(slugNoByc);
  }

  // Handle common BYC campus prefixes/suffixes
  const noByc = trimmed.replace(/\s*-\s*BYC$/i, '').trim();
  if (noByc) {
    variants.add(noByc);
    const noBycSlug = toDepartmentId(noByc);
    if (noBycSlug) variants.add(noBycSlug);
  }

  return Array.from(variants).filter(Boolean);
}

