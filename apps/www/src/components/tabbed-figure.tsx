"use client";

import { useState, type ReactNode } from "react";
import { Figure } from "@/components/report";

/**
 * Tabs in a figure's top row: the docs' tabbed code card
 * (vltpkg/www/docs/src/components/code-card.tsx), ported. The active tab's
 * face flows into the panel, with a concave corner either side of it; the
 * first tab's left side runs straight down the panel's edge.
 */
const Corner = ({ side }: { side: "left" | "right" }) => (
  <span
    className={`absolute bottom-0 size-4 bg-(--code-editor-background) ${side === "left" ? "-left-4" : "-right-4"}`}
  >
    <span
      className={`block size-full border-b bg-card ${
        side === "left" ? "rounded-br-xl border-r" : "rounded-bl-xl border-l"
      }`}
    />
  </span>
);

export const FigureTabStrip = ({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: readonly { readonly value: string; readonly label: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <div
    role="tablist"
    aria-label={label}
    /* It scrolls sideways on a phone, which clips it on every side: one pixel more at the
       bottom, overlapping the panel, so the active tab still covers the panel's top border. */
    className="-mb-px flex h-[calc(--spacing(11)+1px)] overflow-x-auto overflow-y-hidden pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {tabs.map((tab, i) => {
      const active = tab.value === value;
      return (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active}
          data-state={active ? "active" : "inactive"}
          onClick={() => onChange(tab.value)}
          className="group relative h-11 shrink-0 outline-none"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-1 -bottom-px hidden rounded-t-xl border-x border-t bg-(--code-editor-background) group-data-[state=active]:block"
          >
            {/* The first tab's left side runs straight into the panel's square corner. */}
            {i === 0 ? null : <Corner side="left" />}
            <Corner side="right" />
          </span>
          <span className="relative mt-1 flex h-10 items-center gap-1.5 rounded-lg px-3 font-mono text-xs whitespace-nowrap text-muted-foreground group-focus-visible:ring-2 group-focus-visible:ring-ring/50 group-data-[state=active]:text-foreground/75 group-data-[state=inactive]:group-hover:bg-foreground/5 group-data-[state=inactive]:group-hover:text-foreground">
            {tab.label}
          </span>
        </button>
      );
    })}
  </div>
);

export interface FigureTab {
  readonly value: string;
  readonly label: ReactNode;
  readonly content: ReactNode;
}

/** A figure with a tab per view, the active one's content in the panel. */
export const TabbedFigure = ({
  id,
  title,
  kind,
  tabs,
  guide,
}: {
  id: string;
  title: string;
  kind: "bar" | "line";
  tabs: readonly FigureTab[];
  guide?: ReactNode;
}) => {
  const [value, setValue] = useState(tabs[0]?.value ?? "");
  const active = tabs.find((t) => t.value === value) ?? tabs[0];
  return (
    <Figure
      id={id}
      kind={kind}
      title={title}
      guide={guide}
      firstTabActive={active === tabs[0]}
      tabs={<FigureTabStrip label={title} tabs={tabs} value={value} onChange={setValue} />}
    >
      <div role="tabpanel">{active?.content}</div>
    </Figure>
  );
};
