import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The one way this site draws "pick one of these": a row of chips, the chosen
 * one filled with ink.
 *
 * Scenario, fixture, focused tool, run window and scale
 * each had their own drawing of the same idea. The header is the deliberate
 * exception -- it is the docs site's chrome and marks where you ARE with the
 * docs' `bg-accent`; these mark what you PICKED.
 *
 * Two forms because the choice lives in two places. `Segmented` is for state
 * a client island owns. `SegmentedLinks` is for a choice the server acts on:
 * each chip is a real link, so the selection is in the URL, survives a reload
 * and can be shared.
 */
const chip = (selected: boolean): string =>
  `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.8125rem] whitespace-nowrap transition-colors ${
    selected
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-accent hover:text-foreground"
  }`;

const Row = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    {label === undefined ? null : (
      <span className="text-[0.8125rem] text-muted-foreground">{label}</span>
    )}
    <div className="flex flex-wrap items-center gap-1">{children}</div>
  </div>
);

export const Segmented = ({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: readonly { readonly value: string; readonly label: string }[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <Row label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={chip(option.value === value)}
      >
        {option.label}
      </button>
    ))}
  </Row>
);

export const SegmentedLinks = ({
  label,
  options,
}: {
  /** Omitted when a heading above the row already names the choice. */
  label?: string;
  options: readonly {
    readonly href: string;
    readonly label: ReactNode;
    readonly selected: boolean;
    readonly key: string;
  }[];
}) => (
  <Row label={label}>
    {options.map((option) => (
      <Link
        key={option.key}
        href={option.href}
        /* The page is the same page with one choice changed; do not jump. */
        scroll={false}
        aria-current={option.selected ? "true" : undefined}
        className={chip(option.selected)}
      >
        {option.label}
      </Link>
    ))}
  </Row>
);
