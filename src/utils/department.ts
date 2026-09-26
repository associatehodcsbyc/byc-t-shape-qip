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
