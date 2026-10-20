"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense } from "react";

/** Where the reader is: the path, and the query string. */
export interface Here {
  /** `null` in the prerendered shell, where no one path is known. */
  readonly pathname: string | null;
  readonly query: string;
}

type Render = (here: Here) => ReactNode;

const Read = ({ children }: { children: Render }) =>
  children({ pathname: usePathname(), query: useSearchParams().toString() });

/**
 * `children`, given where the reader is. The root layout's client parts -- the
 * sidebar's links, the citation, Copy Page, the snapshot banner -- carry the
 * page's choices and know the page. Neither the query nor, on a report, the
 * path is known while the shell prerenders (every report shares one shell),
 * so the shell holds them without either, and the real values stream in; a
 * client navigation knows them at once. Read either outside this, and the
 * route cannot prerender.
 */
export const WithLocation = ({ children }: { children: Render }) => (
  <Suspense fallback={children({ pathname: null, query: "" })}>
    <Read>{children}</Read>
  </Suspense>
);
