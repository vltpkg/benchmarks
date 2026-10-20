"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useScrolled } from "@/hooks/use-scrolled";

const MotionButton = motion.create(Button);

/* The docs' motion, mirrored: it rises from below rather than dropping from above. */
const FULL = {
  initial: { opacity: 0, filter: "blur(4px)", scale: 0.95, y: 4 },
  animate: { opacity: 1, filter: "blur(0px)", scale: 1, y: 0 },
  exit: { opacity: 0, filter: "blur(4px)", scale: 0.95, y: 4 },
};
const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };

/**
 * The vlt docs' back-to-top button (vltpkg/www/docs/src/components/scroll-to-top.tsx)
 * and its `useScrolled` rule (past 300px), at the BOTTOM of the screen: the
 * top has the header and the page's floating breadcrumb card. Centred over
 * the content column, not the sidebar; z-40, over the bottom page fade (z-30)
 * and under menus. Rendered once, by the root layout.
 *
 * Changed from the docs: the docs' `font-pixel-grid` class names no font there
 * either, so the label renders in the inherited Inter, as it does here; and
 * reduced motion keeps only the fade.
 */
export const ScrollToTop = () => {
  const { scrolled } = useScrolled();
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      {scrolled ? (
        <MotionButton
          key="top"
          size="sm"
          variant="outline"
          // solid fill: outline's dark:bg-input/30 is see-through over the page
          className="fixed right-(--lock-gap) bottom-6 left-0 z-40 mx-auto w-fit bg-background text-xs capitalize shadow-sm md:left-(--sidebar-width) dark:bg-background dark:hover:bg-muted"
          whileTap={{ scale: 1.025 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          {...(reduced === true ? FADE : FULL)}
        >
          <span>back to top</span>
        </MotionButton>
      ) : null}
    </AnimatePresence>
  );
};
