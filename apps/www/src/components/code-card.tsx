"use client";

import { BracesIcon, CheckIcon, CircleAlertIcon, CopyIcon, TerminalIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import { cn } from "@/lib/utils";

/*
 * The docs' code card (vltpkg/www/docs/src/components/code-card.tsx), ported for its one-tab form,
 * which is the only one this site uses. What differs: no package-manager tabs or brand marks, a
 * failed copy shows on the button (this app's `useCopy` has no toasts), and `actions` sit beside
 * copy, for the agent prompt's launch menu.
 */

const shells = new Set(["bash", "sh", "shell", "zsh", "console"]);

// `content` is what the <pre> shows
export type CodeTab = {
  code: string;
  lang?: string;
  title?: string;
  content: ReactNode;
};
type CodeCardProps = Omit<ComponentProps<"pre">, "children"> & {
  tabs: [CodeTab];
  actions?: ReactNode;
};

// the concave corner where the active tab meets the panel's top edge
const Corner = () => (
  <span className="absolute -right-4 bottom-0 size-4 bg-(--code-editor-background)">
    <span className="block size-full rounded-bl-xl border-b border-l bg-card" />
  </span>
);

// a tab's label, plus the indicator that flows into the panel
const TabFace = ({ tab: { lang = "text", title } }: { tab: CodeTab }) => {
  const terminal = shells.has(lang);
  const Icon = terminal ? TerminalIcon : BracesIcon;
  return (
    <>
      <span
        aria-hidden
        className="absolute inset-x-0 top-1 -bottom-px rounded-t-xl border-x border-t bg-(--code-editor-background)"
      >
        {/* the first tab lines up with the panel's edge, so that side runs straight down */}
        <span className="absolute -bottom-4 -left-px size-4 border-l bg-(--code-editor-background)" />
        <Corner />
      </span>
      <span className="relative mt-1 flex h-10 items-center gap-1.5 rounded-lg px-3 font-mono text-xs whitespace-nowrap text-foreground/75">
        <Icon
          aria-hidden
          className={cn("size-3", terminal ? "text-muted-foreground" : "text-amber-600")}
        />
        {title ?? (terminal ? "Terminal" : lang)}
      </span>
    </>
  );
};

export const CodeCard = ({ tabs: [tab], actions, className, ...props }: CodeCardProps) => {
  const { status, copy } = useCopy(1500);

  return (
    <figure
      data-not-typeset
      className="@container relative overflow-hidden rounded-2xl border border-transparent bg-card px-1 pb-1 shadow-lg ring-1 shadow-black/6.5 ring-border-illustration backdrop-blur [--code-editor-background:var(--color-illustration)]"
    >
      <figcaption className="group relative h-11 w-fit">
        <TabFace tab={tab} />
      </figcaption>
      <pre
        className={cn(
          "overflow-x-auto rounded-xl border bg-(--code-editor-background) p-4 font-mono text-[13px] leading-snug text-foreground",
          className,
        )}
        {...props}
      >
        {tab.content}
      </pre>
      <div className="absolute top-2 right-1.5 flex items-center gap-0.5">
        {actions}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void copy(tab.code)}
          aria-label={
            status === "copied" ? "Copied" : status === "failed" ? "Could not copy" : "Copy code"
          }
          className="text-muted-foreground"
        >
          {status === "copied" ? (
            <CheckIcon aria-hidden />
          ) : status === "failed" ? (
            <CircleAlertIcon aria-hidden className="text-destructive" />
          ) : (
            <CopyIcon aria-hidden />
          )}
        </Button>
      </div>
    </figure>
  );
};
