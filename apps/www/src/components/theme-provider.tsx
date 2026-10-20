"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

/**
 * Theme provider.
 *
 * `attribute="data-theme"` is NOT optional and NOT a default. The ported
 * vltpkg docs palette switches on
 * `@custom-variant dark (&:where([data-theme="dark"], …))`, so next-themes'
 * default — toggling a `class` — would leave every dark rule present in the
 * stylesheet and never applied. Dark mode would be silently inert: no error, no
 * failed build, and a light-mode screenshot that looks entirely correct.
 *
 * That is the same failure as the tool ramp Tailwind tree-shook away, one layer
 * up, which is why it is asserted by a named inventory item rather than trusted
 * as configuration.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => (
  <NextThemes attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange>
    {children}
  </NextThemes>
);
