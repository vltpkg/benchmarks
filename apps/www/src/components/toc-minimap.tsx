"use client";

import { goToAnchor } from "@/components/heading-anchor";
/*
 * TOC Minimap by ncdai (chanhdai.com/components/toc-minimap), taken from its
 * registry item (https://chanhdai.com/r/toc-minimap.json) and adapted:
 *
 * - Radix's hover card rather than Base UI's, since Radix is what this app
 *   has: `asChild`, `openDelay`/`closeDelay`, and `data-[state=open]` where
 *   the original reads `data-popup-open`.
 * - No sound on open. The original plays one through a soundcn dependency.
 * - `data-active` is present or absent, not "true"/"false", so the
 *   `data-active:` variants match only the active items.
 * - Fixed to the viewport's right edge and vertically centred, in the page
 *   margin, so it takes no column; shown from 90rem up, where the 80rem page
 *   column leaves room for it. Ticks are flush right.
 */
import { HoverCard } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface TOCItemType {
  title: React.ReactNode;
  url: string;
  depth: number;
}

export const TOCMinimap = ({ items, className }: { items: TOCItemType[]; className?: string }) => {
  const itemIds = useMemo(() => items.map((item) => item.url.replace("#", "")), [items]);
  const active = useActiveHeadings(itemIds);

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "fixed top-1/2 right-[calc(1rem+var(--lock-gap))] z-30 hidden w-18 -translate-y-1/2 min-[90rem]:block",
        className,
      )}
    >
      <HoverCard.Root openDelay={0} closeDelay={0}>
        <HoverCard.Trigger asChild>
          <div className="flex max-h-[50dvh] flex-col items-end gap-3 overflow-hidden py-3 pl-6 opacity-100 transition-opacity duration-200 data-[state=open]:opacity-0">
            {items.map((item) => (
              <div
                key={item.url}
                data-depth={item.depth}
                data-active={active.has(item.url.slice(1)) || undefined}
                className={cn(
                  "h-0.5 w-6 shrink-0 rounded-xs bg-ring/50 transition-[background-color] duration-200",
                  "data-[depth=3]:w-4 data-[depth=4]:w-2",
                  "data-active:bg-foreground",
                )}
              />
            ))}
          </div>
        </HoverCard.Trigger>

        <HoverCard.Portal>
          <HoverCard.Content
            align="start"
            side="left"
            sideOffset={-60}
            className="z-40 w-56 overflow-hidden rounded-lg border bg-popover p-0 text-popover-foreground shadow-md"
          >
            <nav
              aria-label="On this page"
              className="flex max-h-[50dvh] overflow-y-auto overscroll-contain"
            >
              <ul className="flex size-full flex-col px-6 py-4 text-sm">
                {items.map((item) => (
                  <li key={item.url} className="flex py-1">
                    <a
                      href={item.url}
                      data-depth={item.depth}
                      data-active={active.has(item.url.slice(1)) || undefined}
                      className={cn(
                        "line-clamp-2 w-full transition-[color] duration-200",
                        "text-muted-foreground hover:text-foreground data-active:text-foreground",
                        "data-[depth=3]:pl-4 data-[depth=4]:pl-8",
                      )}
                      onClick={handleItemClick}
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </HoverCard.Content>
        </HoverCard.Portal>
      </HoverCard.Root>
    </div>
  );
};

/*
 * Exactly one item: the one being read. A reading line sits a quarter of the
 * way down the space under the sticky header; the active item is the one whose
 * element most recently crossed it (the greatest top still above the line, the
 * deeper item on a tie -- a figure over the section that holds it). Before the
 * first crosses, the first is active; at the very bottom of the page, the last
 * one on screen is, since the final sections may be too short to ever reach
 * the line. Measured on scroll and resize, once per frame.
 */
const useActiveHeadings = (itemIds: string[]) => {
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      /* The header as drawn: the navbar, and the snapshot banner when there is one. */
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 56;
      const line = header + (window.innerHeight - header) / 4;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let best: { id: string; top: number } | null = null;
      for (const id of itemIds) {
        const element = document.getElementById(id);
        if (element === null) continue;
        const top = element.getBoundingClientRect().top;
        const reached = atBottom ? top < window.innerHeight : top <= line;
        if (reached && (best === null || top >= best.top)) best = { id, top };
      }
      const id = best?.id ?? itemIds.find((i) => document.getElementById(i) !== null);
      setActive((current) =>
        id === undefined
          ? new Set()
          : current.size === 1 && current.has(id)
            ? current
            : new Set([id]),
      );
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [itemIds]);

  return active;
};

const handleItemClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  goToAnchor((e.currentTarget.getAttribute("href") ?? "").replace("#", ""));
};
