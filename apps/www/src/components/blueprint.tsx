import type { ComponentType, SVGProps } from "react";
import { Bun } from "@/components/icons/bun";
import { Deno } from "@/components/icons/deno";
import { Npm } from "@/components/icons/npm";
import { Pnpm } from "@/components/icons/pnpm";
import { Vlt } from "@/components/icons/vlt";

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/** Back to front. `only` keeps a busy mark to the paths that carry its shape. */
const MARKS: readonly { name: string; Icon: Icon; only?: string }[] = [
  { name: "vlt", Icon: Vlt },
  { name: "npm", Icon: Npm },
  { name: "pnpm", Icon: Pnpm },
  /* bun: the body, the eyes and the mouth; not the cheeks, glints or its double contour. */
  {
    name: "bun",
    Icon: Bun,
    only: "[&_path:not(:nth-child(1),:nth-child(4),:nth-child(6))]:hidden",
  },
  { name: "deno", Icon: Deno },
];

/* An isometric rack of slides: each panel stands upright facing the viewer's
   left, and the row recedes up and to the left. One unit along the row moves
   (K, 0.5) on screen; one unit across a panel moves (K, -0.5); up is up. */
const K = 0.866;
const SIDE = 30;
const STEP = 21;
const LOGO = 18;
const INSET = (SIDE - LOGO) / 2;
const THICK = 1;
const REACH = 12;
const X0 = 12;
const Y0 = 19;
const W = 122;
const H = 100;

const origin = (i: number): readonly [number, number] => [X0 + i * STEP * K, Y0 + i * STEP * 0.5];
const face = (i: number): string => {
  const [x, y] = origin(i);
  return `matrix(${K} -0.5 0 1 ${x} ${y})`;
};

const OUTLINE =
  "[&_path]:fill-none [&_path]:stroke-ink-soft [&_path]:[stroke-dasharray:3_3] [&_path]:[stroke-width:1px] [&_path]:[vector-effect:non-scaling-stroke]";
const SOLID = "[&_path]:fill-ink [&_path]:stroke-none";

/** The vlt mark's lower node, in the mark's own 24 units: where the docs'
    404 blueprint puts its construction circle. */
const LENS = { cx: 12, cy: 17.9, r: 5 };

/** The two rails the panels stand on, running past both ends of the row. */
const rail = (across: number): string => {
  const [x, y] = origin(0);
  const [bx, by] = [x + K * across, y - 0.5 * across + SIDE];
  const far = (MARKS.length - 1) * STEP + REACH;
  return `M${bx - K * REACH} ${by - 0.5 * REACH}L${bx + K * far} ${by + 0.5 * far}`;
};

/**
 * The package managers as a blueprint, after the vlt docs' 404 mark: each
 * logo a dashed outline on a glass slide, the slides racked from the top left
 * to the bottom right, and one construction circle drawn solid.
 */
export const Blueprint = ({ className = "" }: { className?: string }) => (
  <svg viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden className={`text-ink ${className}`}>
    <defs>
      <linearGradient
        id="blueprint-rail"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="0"
        x2={W}
        y2="0"
      >
        <stop offset="0" stopColor="currentColor" stopOpacity="0" />
        <stop offset="0.14" stopColor="currentColor" stopOpacity="0.28" />
        <stop offset="0.86" stopColor="currentColor" stopOpacity="0.28" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="blueprint-glass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity="0.07" />
        <stop offset="1" stopColor="currentColor" stopOpacity="0" />
      </linearGradient>
      <clipPath id="blueprint-lens">
        <circle {...LENS} />
      </clipPath>
    </defs>

    <g stroke="url(#blueprint-rail)" strokeWidth="1">
      <path d={rail(0)} vectorEffect="non-scaling-stroke" />
      <path d={rail(SIDE)} vectorEffect="non-scaling-stroke" />
    </g>

    {MARKS.map(({ name, Icon, only = "" }, i) => {
      const [x, y] = origin(i);
      return (
        <g key={name}>
          {/* The slide's far face, a hair behind: its thickness. */}
          <rect
            width={SIDE}
            height={SIDE}
            transform={`translate(${-K * THICK} ${-0.5 * THICK}) ${face(i)}`}
            className="fill-background stroke-ink-faint/50"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <g transform={face(i)}>
            <rect width={SIDE} height={SIDE} className="fill-background" fillOpacity="0.86" />
            <rect
              width={SIDE}
              height={SIDE}
              fill="url(#blueprint-glass)"
              className="stroke-ink-faint"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <Icon x={INSET} y={INSET} size={LOGO} className={`${OUTLINE} ${only}`} />
          </g>
          <text
            x={x - 2.5}
            y={y + SIDE + 0.6}
            textAnchor="end"
            fontSize="2.5"
            className="fill-ink-faint font-mono"
          >
            {name}
          </text>
        </g>
      );
    })}

    {/* Drawn in the plane of the first slide, so it leans with the mark. */}
    <g transform={`${face(0)} translate(${INSET} ${INSET}) scale(${LOGO / 24})`}>
      <g clipPath="url(#blueprint-lens)">
        <Vlt size={24} className={SOLID} />
      </g>
      <circle
        {...LENS}
        className="stroke-ink-soft"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </g>
  </svg>
);
