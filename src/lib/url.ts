// Adds Astro's base path, so the site also works in a sub-folder.
export function url(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
