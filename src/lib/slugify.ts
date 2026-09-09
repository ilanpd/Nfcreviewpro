const DIACRITICS_REGEX = /[̀-ͯ]/g;

/** Shared by company.service.ts (URL slugs) and utm.ts (utm_campaign values)
 * — both need the same "lowercase, strip accents, dashes for everything
 * else" transform. NFD-normalizing before stripping is what makes "café" ->
 * "cafe" instead of leaving the accented character as a stray dash. */
export function slugify(value: string, { fallback = "", maxLength }: { fallback?: string; maxLength?: number } = {}): string {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const result = slug || fallback;
  return maxLength ? result.slice(0, maxLength) : result;
}
