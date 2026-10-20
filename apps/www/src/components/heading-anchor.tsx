"use client";

import { CheckIcon, LinkIcon } from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import { ogFigure } from "@/lib/og-figure";
import { isSectionId } from "@/lib/sections";

/**
 * The address of a link to `id` on this page: the page as it is, plus the
 * anchor. On a report, a figure with a social card of its own also goes in
 * the query (`figure`), since an unfurler never sees the anchor; any other
 * anchor drops it.
 */
export const anchorHref = (id: string): string => {
  const { pathname, search } = window.location;
  const query = new URLSearchParams(search);
  if (isSectionId(pathname.split("/")[1]) && ogFigure(id) !== null) query.set("figure", id);
  else query.delete("figure");
  const rest = query.toString();
  return `${pathname}${rest ? `?${rest}` : ""}#${id}`;
};

/**
 * Go to an anchor on this page and put its address in the bar (`anchorHref`):
 * a history entry, as a plain anchor link makes, and no reload -- Next keeps
 * its router in step with `pushState`.
 */
export const goToAnchor = (id: string) => {
  history.pushState(null, "", anchorHref(id));
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
};

/** A heading's link to itself, which also names its figure in the address (`goToAnchor`). */
export const HeadingLink = ({ to, ...props }: ComponentProps<"a"> & { to: string }) => (
  <a
    {...props}
    href={`#${to}`}
    onClick={(e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      goToAnchor(to);
    }}
  />
);

/**
 * Copy a link to a heading, from a link icon that hangs in the margin to the
 * heading's left. It is out of the flow, so the title starts where every other
 * title does, and it shows only while the heading is hovered (the heading
 * carries `group/heading`) or the button has keyboard focus. After a copy it
 * turns to a check and stays visible for a moment whether hovered or not.
 *
 * The link is the page as it is -- path and every query parameter -- plus the
 * anchor, so what is pasted reproduces what was on screen. On a report, a
 * figure with a social card of its own also goes in the query (`figure`):
 * an unfurler never sees the anchor, and the preview should be that figure.
 */
export const HeadingAnchor = ({
  id,
  title,
  className = "right-full mr-2.5",
}: {
  id: string;
  title: string;
  /** Where it sits, against the nearest positioned ancestor. */
  className?: string;
}) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      data-copied={copied ? "" : undefined}
      onClick={() => {
        void navigator.clipboard
          .writeText(`${window.location.origin}${anchorHref(id)}`)
          .then(() => setCopied(true));
      }}
      aria-label={copied ? "Copied" : `Copy link to ${title}`}
      className={`absolute top-1/2 ${className} grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,color] duration-150 group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring data-copied:opacity-100 data-copied:text-foreground after:absolute after:inset-y-0 after:left-full after:w-2.5 [&_svg]:size-3.5`}
    >
      {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
    </button>
  );
};
