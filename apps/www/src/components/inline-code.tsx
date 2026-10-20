import type { ReactNode } from "react";

/**
 * A name set apart from the prose around it -- a tool, a registry host, a
 * scenario, a runner label -- as vlt.io sets inline code
 * (apps/www/src/components/ui/inline-code.tsx, its default variant): mono, in
 * a hairline-bordered chip on a neutral fill, near-white in light and
 * near-black in dark. Every measure is in `em`, so one component serves a
 * display headline and a line of body text alike. `nowrap` keeps
 * "yarn (berry)" in one chip rather than split across lines.
 *
 * `size` follows the docs' typeset: `display` is their code-in-a-heading
 * (0.9em), `text` their inline code (0.85em). Tracking is reset, so a chip in
 * a tightly tracked headline stays readable.
 */
const SIZE = {
  display: "text-[0.9em]",
  text: "text-[0.85em]",
} as const;

export const InlineCode = ({
  children,
  size = "display",
}: {
  children: ReactNode;
  size?: keyof typeof SIZE;
}) => (
  <code
    className={`inline-block rounded-[0.25em] border border-border bg-neutral-100 px-[0.3em] font-mono leading-[1.3] font-normal tracking-normal whitespace-nowrap dark:bg-neutral-950 ${SIZE[size]}`}
  >
    {children}
  </code>
);

/** Text with names between backticks, as `lib/findings.ts` marks them. */
export const Marked = ({ text }: { text: string }) =>
  text.split("`").map((part, i) => (i % 2 === 1 ? <InlineCode key={i}>{part}</InlineCode> : part));
