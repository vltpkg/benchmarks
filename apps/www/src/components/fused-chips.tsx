import { useId } from "react";
import { cn } from "@/lib/utils";

const ROW = "flex flex-wrap gap-x-1 gap-y-2 font-mono text-xs";
const PILL = "inline-flex h-6 items-center rounded-full px-2.5 whitespace-nowrap";

/**
 * Tags that read as one group: pills fused by a concave neck where they meet,
 * like metaballs. Two identical layouts, one over the other. The lower draws
 * only the fills, through a goo filter (blur, then a hard alpha threshold) that
 * melts the 4px gaps into necks; the 8px between wrapped rows stays open. The
 * upper is the list itself, crisp text on no fill, read once by assistive tech.
 */
export const FusedChips = ({
  items,
  className,
}: {
  items: readonly string[];
  className?: string;
}) => {
  // Bare: React's ids carry characters a url() reference can trip on.
  const filter = `goo${useId().replace(/\W/g, "")}`;
  return (
    <div className={cn("relative", className)}>
      <svg aria-hidden className="absolute size-0">
        {/* Fuse the fills, then outline the fused shape itself: grow it a pixel,
            paint that the edge colour, and lay the fill back on top. One even
            hairline round the whole group, necks included. */}
        <filter id={filter} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="4" />
          <feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="fill" />
          <feMorphology in="fill" operator="dilate" radius="1" result="grown" />
          <feFlood style={{ floodColor: "var(--border)" }} />
          <feComposite in2="grown" operator="in" result="edge" />
          <feMerge>
            <feMergeNode in="edge" />
            <feMergeNode in="fill" />
          </feMerge>
        </filter>
      </svg>
      <div aria-hidden className={`absolute inset-0 ${ROW}`} style={{ filter: `url(#${filter})` }}>
        {items.map((item) => (
          <span key={item} className={`${PILL} bg-muted text-transparent`}>
            {item}
          </span>
        ))}
      </div>
      <ul className={`relative ${ROW} text-foreground`}>
        {items.map((item) => (
          <li key={item} className={PILL}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};
