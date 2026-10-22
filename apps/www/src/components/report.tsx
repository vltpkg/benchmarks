import { BarChart3, Info, LineChart, ScatterChart, Table2 } from "lucide-react";
import type { ReactNode } from "react";
import { HeadingAnchor, HeadingLink } from "@/components/heading-anchor";

/**
 * The report furniture: sections, the one container every figure and table
 * sits in, and stat tiles.
 *
 * Two levels and no more. A section is an h2 and each figure or table in it
 * an h3 -- unless the section holds a single table, in which case the table's
 * title IS the section's h2. Nothing is said twice: there is no section
 * summary and no subtitle under a title; a section's own h2 links to itself.
 *
 * There is no margin column and no numbering. Every section and figure keeps
 * its `id`, and its title links to it, so a deep link to a figure works.
 * Hovering a title shows `HeadingAnchor`, a copy-link icon in the margin.
 */
const ANCHOR = "scroll-mt-[calc(var(--header-height)+4.5rem)]";

export const ReportSection = ({
  id,
  title,
  children,
}: {
  id: string;
  /**
   * Omitted for a section that holds one table: the table's own title is then
   * the section's heading, so the same thing is not said twice in a stack.
   */
  title?: string;
  children: ReactNode;
}) => (
  <section id={id} className={`${ANCHOR} mt-24 data-mode:mt-12`}>
    {title === undefined ? null : (
      <h2 className="group/heading relative mb-8 w-fit data-mode:mb-4 text-2xl font-semibold tracking-tight">
        <HeadingLink to={id} className="rounded-sm">
          {title}
        </HeadingLink>
        <HeadingAnchor id={id} title={title} />
      </h2>
    )}
    <div className="space-y-10 data-mode:space-y-6">{children}</div>
  </section>
);

const ICONS = {
  line: LineChart,
  bar: BarChart3,
  dots: ScatterChart,
  table: Table2,
} as const;

export type FigureKind = keyof typeof ICONS;

/* The concave corner where the tab meets the panel's top edge: a square in
   the panel's colour with a shell-coloured, rounded, bordered square inside
   it. Ported from the docs' code card. A wrong token here shows as a notch. */
const Corner = () => (
  <span className="absolute -right-4 bottom-0 size-4 bg-(--code-editor-background)">
    <span className="block size-full rounded-bl-xl border-b border-l bg-card" />
  </span>
);

/**
 * The container every figure and every table sits in: the docs site's code
 * card (vltpkg/www/docs/src/components/code-card.tsx), ported -- structure
 * and values -- rather than approximated.
 *
 *   the shell   a `rounded-2xl` card a shade off the page, ringed with a
 *               hairline, holding everything with a 4px inset
 *   the tab     top left, in the PANEL's colour and border, open at the
 *               bottom so it flows into the panel, with the concave corner
 *               where its right side meets the panel's top edge
 *   the action  top right of the shell, outside the panel: the figure's
 *               own controls, where the code card has copy
 *   the panel   `rounded-xl`, bordered, in the page's own colour, holding the
 *               content
 *
 * ON A CHART, THE TAB IS THE TITLE. It carries an icon for the kind of chart
 * and the figure's name, and that name is the heading -- a real one, for the
 * document outline -- and the link to the figure's own anchor. To its right,
 * in the same row: the figure's controls (`actions`). Copy-link is the
 * hover icon (`HeadingAnchor`), which takes the kind icon's place.
 *
 * A TABLE HAS NO TAB. The shell and the inset panel are the same -- same
 * radii, border and shadow, so a table and a chart are one family -- but the
 * panel's top edge is plain. The table's title is a heading above the
 * container, with the hover copy-link in the margin to its left.
 *
 * Either way there is exactly one visible title, and the reading guide and
 * notes sit below the container.
 *
 * The panel has no padding of its own: a table runs to its edges, and a
 * chart's rows (`ChartFrame`) bring theirs.
 *
 * TWO THINGS THE TAB DEPENDS ON, both easy to break:
 *
 * - The panel must NOT be positioned. The tab's face is absolute and reaches
 *   one pixel below the tab row, over the panel's top border, which is what
 *   makes the tab open into the panel. A positioned panel, coming later in
 *   the document, paints over that pixel and the tab gets a bottom border --
 *   which is exactly what `relative` on the panel did.
 * - Whatever is first inside the panel must be the panel's own colour, or the
 *   tab opens onto a band of a different shade. So the table's header row is
 *   not tinted.
 *
 * The docs card squares off the panel's top-left corner with a filler that
 * overhangs 16px into the panel, which is fine over a code block's padding
 * and would sit on top of a table header here. The panel's top-left corner is
 * simply not rounded instead; the tab's left edge runs straight into it.
 */
export const Figure = ({
  id,
  kind,
  title,
  guide,
  notes = [],
  actions,
  level = 3,
  titlePrefix,
  tabLead,
  footer,
  live = false,
  tabs,
  firstTabActive = true,
  children,
}: {
  id: string;
  /** What this is. A table has no tab; every chart does. */
  kind: FigureKind;
  title: string;
  /** How to read it: what the marks and their encodings mean. */
  guide?: ReactNode;
  /** Limits and caveats that belong to this figure and no other. */
  notes?: readonly Note[];
  /**
   * Controls for the top row, right of the tab and before the copy-link
   * button. Any figure may place controls here; the time series puts its date
   * range and scale in it.
   */
  actions?: ReactNode;
  /** 2 when the figure is the only thing in its section and heads it. */
  level?: 2 | 3;
  /** Read before the title by assistive technology, not shown: what the tab names. */
  titlePrefix?: string;
  /** Shown in the tab before the title, e.g. what the title belongs to. */
  tabLead?: ReactNode;
  /**
   * A row under the panel, inside the shell, the tab row's counterpart: e.g.
   * summary chips on the left and a call to action on the right.
   */
  footer?: ReactNode;
  /** Redraws from the URL itself, so a pending report never marks it stale. */
  live?: boolean;
  /**
   * A tab per view (`FigureTabStrip`) in place of the one title tab: the
   * title is then a heading above the container, as a table's is.
   */
  tabs?: ReactNode;
  /** With `tabs`: the first is active, so the panel's corner under it is square. */
  firstTabActive?: boolean;
  children: ReactNode;
}) => {
  const Icon = ICONS[kind];
  const Heading = level === 2 ? "h2" : "h3";
  const link = (
    <HeadingLink to={id} id={`${id}-title`} className="truncate rounded-sm">
      {titlePrefix === undefined ? null : <span className="sr-only">{titlePrefix} </span>}
      {title}
    </HeadingLink>
  );
  return (
    <figure
      id={id}
      aria-labelledby={`${id}-title`}
      data-live={live || undefined}
      className={ANCHOR}
    >
      {kind === "table" || tabs !== undefined ? (
        /* A table has no tab, and tabs name views: the title is a heading above the container. */
        <Heading
          className={`group/heading relative mb-5 flex w-fit max-w-full items-center gap-2 data-mode:mb-3 ${
            level === 2 ? "text-2xl font-semibold tracking-tight" : "text-lg font-semibold"
          }`}
        >
          {kind === "table" ? null : <Icon aria-hidden className="size-4 shrink-0 text-brand" />}
          {link}
          <HeadingAnchor id={id} title={title} />
        </Heading>
      ) : null}

      <div
        data-shimmer
        className={`relative overflow-hidden rounded-2xl border border-transparent bg-card shadow-lg ring-1 shadow-black/6.5 ring-border-illustration [--code-editor-background:var(--color-illustration)] ${
          kind === "table" ? "p-1" : "px-1 pb-1"
        }`}
      >
        {kind === "table" ? null : (
          <div className="flex items-start justify-between gap-3">
            {tabs !== undefined ? (
              <div className="min-w-0 shrink">{tabs}</div>
            ) : (
              <figcaption className="relative h-11 min-w-0 shrink">
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1 -bottom-px rounded-t-xl border-x border-t bg-(--code-editor-background)"
                >
                  <Corner />
                </span>
                {/* On hover the copy-link icon takes the kind icon's place. */}
                <Heading className="group/heading relative mt-1 flex h-10 min-w-0 items-center gap-2 px-3 font-mono text-xs text-foreground/75">
                  <Icon
                    aria-hidden
                    className="size-3.5 shrink-0 text-brand transition-opacity duration-150 group-hover/heading:opacity-0 group-has-focus-visible/heading:opacity-0 group-has-data-copied/heading:opacity-0"
                  />
                  {tabLead}
                  {link}
                  <HeadingAnchor id={id} title={title} className="left-[0.4375rem]" />
                </Heading>
              </figcaption>
            )}
            {/* The figure's own controls, clear of the concave corner by the
                row's gap. */}
            <div className="flex h-11 shrink-0 items-center gap-1.5 pt-1 pr-0.5 pl-4">
              {actions}
            </div>
          </div>
        )}
        <div
          className={`overflow-hidden rounded-xl border bg-(--code-editor-background) ${
            kind === "table" || !firstTabActive ? "" : "rounded-tl-none"
          }`}
        >
          {children}
        </div>
        {footer === undefined ? null : (
          /* Inset as the panel is (the shell's 4px), so a control in a corner is
             concentric with it: the shell's 16px less 4px is the controls' 12px. */
          <div className="flex flex-wrap items-center justify-between gap-1 pt-1">{footer}</div>
        )}
      </div>

      {guide === undefined ? null : (
        <p
          data-narrative
          className="mt-4 max-w-[78ch] text-sm leading-relaxed text-muted-foreground"
        >
          {guide}
        </p>
      )}
      {notes.map((note) => (
        <div key={note.title} className="mt-3">
          <Callout title={note.title}>{note.body}</Callout>
        </div>
      ))}
    </figure>
  );
};

/** A caveat: what it is about, in a line, then what it means. */
export interface Note {
  readonly title: string;
  readonly body: ReactNode;
}

/**
 * A caveat set apart from the prose: a hairline card a shade off the page,
 * an info mark, a short title at full ink and the explanation beneath it.
 * Quiet, but read at a glance -- a muted paragraph behind a rule was not.
 */
export const Callout = ({ title, children }: { title: string; children: ReactNode }) => (
  <div
    role="note"
    data-narrative
    className="flex w-full gap-3 rounded-xl border bg-card px-4 py-3.5 text-sm leading-relaxed"
  >
    <Info aria-hidden className="mt-[0.1875rem] size-4 shrink-0 text-muted-foreground" />
    <div className="min-w-0">
      <p className="font-medium text-foreground">{title}</p>
      <div className="mt-0.5 text-foreground/70">{children}</div>
    </div>
  </div>
);

/**
 * One number, in the container every figure sits in: the shell a shade off
 * the page with its hairline ring, and the panel inside it. One element, so
 * it can stay a `dl` group: the shell is its border, the panel's hairline an
 * inset ring. A mono label at the top, then space, then the value and the
 * sentence saying what it means.
 */
export const Stat = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
}) => (
  /* Label, value and sentence are three rows of the parent grid (subgrid), so
     every tile in a row shares them: the values sit on one line however many
     lines a neighbour's sentence wraps to. The parent must be a grid. */
  <div className="row-span-3 grid grid-rows-subgrid gap-0 rounded-2xl border-4 border-card bg-illustration p-4 shadow-lg ring-1 inset-ring shadow-black/6.5 ring-border-illustration inset-ring-border">
    <dt className="font-pixel text-xs text-muted-foreground">{label}</dt>
    <dd className="tabular self-end pt-12 text-4xl font-semibold tracking-tight">{value}</dd>
    <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail}</dd>
  </div>
);

/**
 * A chart's rows inside the panel: the plot, then the legend.
 *
 * No frame of its own -- the panel around it (`Figure`) is the frame -- and
 * no controls row: a chart's controls are in the container's top row, beside
 * the tab. The legend, when a chart needs one, is last, always, and is a
 * bordered grid that meets the panel's edges and draws its own top border.
 */
export const ChartFrame = ({ legend, children }: { legend?: ReactNode; children: ReactNode }) => (
  <>
    <div className="p-4">{children}</div>
    {legend}
  </>
);
