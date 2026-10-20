/**
 * Social cards, rendered by takumi as vlt.io renders its own
 * (vlt.io/apps/www/src/lib/opengraph/takumi.ts): 1200×630 PNG, with the same
 * two faces loaded once per process -- Inter Medium for words, Geist Mono for
 * names and numbers. Takumi never reads system fonts or the site's
 * `next/font` files, so the TTFs sit in `public/assets/fonts`: vlt.io's Inter,
 * and the previous app's Geist Mono (vlt.io's `geist-mono.ttf` is Geist, the sans).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "@takumi-rs/image-response";
import type { ReactElement } from "react";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const font = (file: string) => readFile(join(process.cwd(), "public", "assets", "fonts", file));

let fonts: Promise<{ name: string; data: Buffer; weight?: number }[]> | null = null;

const loadFonts = () =>
  (fonts ??= Promise.all([font("inter.ttf"), font("geist-mono.ttf")]).then(([inter, mono]) => [
    { name: "Inter", data: inter, weight: 500 },
    // Variable: `fontWeight` sets its axis.
    { name: "Geist Mono", data: mono },
  ]));

export const renderOgImage = async (
  element: ReactElement,
  cacheControl: string,
): Promise<ImageResponse> =>
  new ImageResponse(element, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: await loadFonts(),
    // Explicit, as vlt.io learned: takumi labels an unspecified format as WebP.
    format: "png",
    headers: { "Cache-Control": cacheControl },
  });
