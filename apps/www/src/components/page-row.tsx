"use client";

import { animate, LayoutGroup, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export const SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;
export const FADE = { duration: 0.15, ease: "easeOut" } as const;

/* The cards' column: centred over the content column, not the viewport, so it never sits over the sidebar. */
const STACK =
  "pointer-events-none fixed left-4 right-[calc(1rem+var(--lock-gap))] top-[calc(var(--header-height)+0.75rem)] z-40 flex flex-col gap-1 sm:left-0 sm:right-(--lock-gap) sm:items-center sm:px-4 md:left-(--sidebar-width)";
const CARD = "pointer-events-auto relative sm:max-w-full";
/* What the chips take besides their own lines, the same in both places: their pt-4 in the page; pt-1 and the card's p-1.5 afloat. */
const GAP = 16;

/** A card's surface: a layer that fades in under its content as it floats, so the content never stretches. */
const Surface = ({
  away,
  reduced,
  still,
  shared,
}: {
  away: boolean;
  reduced: boolean;
  /** No fade either: the card appears at once. */
  still: boolean;
  shared: object;
}) => (
  <motion.div
    aria-hidden
    layout={!still}
    {...shared}
    initial={false}
    animate={{ opacity: away ? 1 : 0 }}
    transition={still && !reduced ? { duration: 0 } : reduced ? FADE : SPRING}
    style={{ borderRadius: 12 }}
    className="pointer-events-none absolute inset-0 border bg-background shadow-sm"
  />
);

/**
 * A page's first row -- breadcrumbs on the left, the page's menus on the right
 * -- and the selection chips under it, which, once the row starts under the
 * header, become two cards fixed just below it, so the filters stay in reach
 * down a long report.
 *
 * ONE ELEMENT, TWO PLACES: each turns fixed and motion's layout animation
 * morphs it from its place in the page to its card and back, so the menus are
 * never remounted and an open one survives the switch, and a chip cleared in
 * the card is the chip in the page. The children animate position only, so the
 * text never stretches. One trigger and one LayoutGroup, so the two move as a
 * set. While they float, the slot keeps the row's height and the chips'.
 *
 * THE CHIPS' SPACE IS ONE VALUE: their footprint, 0 without any, springs as
 * chips come and go and is the chips' height in the page and their share of
 * the slot while they float, so what follows glides instead of jumping, in
 * both places, and the switch between them is exact. Afloat, the card fills
 * it, so it grows and collapses with it, fading and shrinking toward the bar.
 * Below sm the row's card holds only the menus, and the trail fades back in as
 * the card returns. z-40: over the content and the charts, under the header
 * and the menus it opens (z-50). Reduced motion: the cards jump, their
 * surfaces fade, and the space changes at once.
 */
export const PageRow = ({
  className,
  trail,
  menus,
  chips,
}: {
  className: string;
  trail: ReactNode;
  menus: ReactNode;
  chips?: ReactNode;
}) => {
  const slot = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** The row's height in the page while it floats; null while it is in the page. */
  const [spacer, setSpacer] = useState<number | null>(null);
  const away = spacer !== null;
  /** The chips' lines, 0 without any (a leaving chip is popped out of them); null until measured, when the SSR height stands. */
  const [listHeight, setListHeight] = useState<number | null>(null);
  const shown = listHeight !== 0;
  const footprint = useMotionValue(0);
  const measured = useRef(false);
  /** Whether it has floated yet: only then does the trail, hidden in the phone's card, fade back. */
  const [floated, setFloated] = useState(false);
  /** The row was jumped past, not scrolled past: a reload's restored scroll, a link to an anchor. */
  const [jumped, setJumped] = useState(false);
  const reduced = useReducedMotion() === true;

  /* Next keeps a page just left mounted and hidden, and shows it again on the
     way back, scrolled elsewhere: it must not paint the card it left with, nor
     morph from it. Back in the page at once, before paint; the observer below
     floats it again if it should be. */
  useLayoutEffect(() => {
    setSpacer(null);
    setJumped(true);
  }, []);

  useEffect(() => {
    const element = slot.current;
    if (!element) return;
    const header = document.querySelector("header")?.getBoundingClientRect().height ?? 56;
    // Away once the header starts to cover it: the morph begins where the row is still seen.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        const covered = entry.intersectionRatio < 1 && entry.boundingClientRect.top < header;
        const height = row.current?.offsetHeight ?? 0;
        setSpacer((current) => (covered ? (current ?? height) : null));
        // Already out of sight, the morph would fly in from off-screen: the card just appears.
        setJumped(covered && entry.boundingClientRect.bottom < 0);
        if (covered) setFloated(true);
      },
      { rootMargin: `-${header}px 0px 0px 0px`, threshold: [0, 1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setListHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (listHeight === null) return;
    const target = listHeight === 0 ? 0 : GAP + listHeight;
    // The first measure only takes over from the SSR height, which it equals.
    if (!measured.current || reduced) {
      measured.current = true;
      footprint.jump(target);
      return;
    }
    const controls = animate(footprint, target, SPRING);
    return () => controls.stop();
  }, [footprint, listHeight, reduced]);

  const still = reduced || jumped;
  const shared = { layoutDependency: away, transition: still ? { duration: 0 } : SPRING };
  return (
    <LayoutGroup>
      <div ref={slot}>
        <div className={away ? STACK : undefined}>
          <motion.div
            ref={row}
            layout={!still}
            {...shared}
            className={
              away ? `${CARD} flex items-center gap-4 p-1.5` : `relative z-40 ${className}`
            }
          >
            <Surface away={away} reduced={reduced} still={still} shared={shared} />
            <motion.div
              layout={still ? false : "position"}
              {...shared}
              className={away ? "relative ml-2 max-sm:hidden" : "relative"}
            >
              <div
                className={
                  floated ? "max-sm:animate-in max-sm:duration-300 max-sm:fade-in-0" : undefined
                }
              >
                {trail}
              </div>
            </motion.div>
            <motion.div
              layout={still ? false : "position"}
              {...shared}
              className="relative w-full sm:w-auto"
            >
              {menus}
            </motion.div>
          </motion.div>
          {chips === undefined ? null : (
            <motion.div
              initial={false}
              animate={{ opacity: shown ? 1 : 0, scale: shown || !away || reduced ? 1 : 0.96 }}
              transition={reduced ? FADE : SPRING}
              style={{ height: listHeight === null ? undefined : footprint, originY: 0 }}
              className={away ? (shown ? "pointer-events-auto" : undefined) : "relative z-40"}
            >
              <div className={`h-full ${away ? "pt-1" : "has-[li]:pt-4"}`}>
                <motion.div
                  layout={!still}
                  {...shared}
                  className={`relative h-full ${away ? "p-1.5 sm:max-w-full" : ""}`}
                >
                  <Surface away={away} reduced={reduced} still={still} shared={shared} />
                  <div ref={list} className="relative">
                    {chips}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
        {away ? (
          <motion.div
            aria-hidden
            className="box-content"
            style={{ paddingTop: spacer, height: footprint }}
          />
        ) : null}
      </div>
    </LayoutGroup>
  );
};
