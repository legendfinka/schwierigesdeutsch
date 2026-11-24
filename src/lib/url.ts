/**
 * Internal link that respects Astro's `base` (needed if the site is hosted in a
 * sub-folder, e.g. GitHub Pages project sites). url('/nouns/') → '/base/nouns/'.
 */
export function url(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
