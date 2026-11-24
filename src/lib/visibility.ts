/** True when the entry has a `verified` record. */
export function isVerified(data: { verified?: unknown }): boolean {
  return data.verified !== undefined;
}

/**
 * Unverified content is shown only in dev (with an "unreviewed" badge),
 * never in a production build. Pass `import.meta.env.DEV` as `dev`.
 */
export function isVisible(data: { verified?: unknown }, dev: boolean): boolean {
  return dev || isVerified(data);
}
