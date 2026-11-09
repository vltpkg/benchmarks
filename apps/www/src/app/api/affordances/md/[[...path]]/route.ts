/*
 * Every page's Markdown twin, reached through withMd's rewrites (next.config.ts).
 * The All-time report (`/package-managers/clean?range=all`) fits the default
 * `maxBytes`: it counts the HTML kept once the Flight data is stripped.
 */
export { GET } from "@affordances/md/next";
