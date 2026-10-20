"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  startTransition,
  use,
  useTransition,
  type ComponentProps,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

/**
 * Whether the server is re-rendering the report for a changed SERVER
 * parameter. Every writer of one starts its navigation in one of these two
 * transitions, so Next keeps the page on screen meanwhile instead of
 * suspending it, and the report says it is stale.
 *
 * Two, because a tools change is not a data change: the trend redraws its
 * lines from `hide` at once, so only the tables and bars are stale. Anything
 * else (fixture, window, metric, exclusions, date) changes what the trend
 * plots too.
 *
 * Outside a report the transitions are plain ones and nothing is pending.
 */
interface Pending {
  readonly data: boolean;
  readonly tools: boolean;
  readonly startTransition: TransitionStartFunction;
  readonly startToolsTransition: TransitionStartFunction;
}

const PendingContext = createContext<Pending>({
  data: false,
  tools: false,
  startTransition,
  startToolsTransition: startTransition,
});

export const usePending = (): Pending => use(PendingContext);

export const PendingProvider = ({ children }: { children: ReactNode }) => {
  const [data, startData] = useTransition();
  const [tools, startTools] = useTransition();
  return (
    <PendingContext
      value={{ data, tools, startTransition: startData, startToolsTransition: startTools }}
    >
      {children}
    </PendingContext>
  );
};

/** The part of the report the server shapes: dimmed while it is stale, never blanked. */
export const PendingRegion = ({ children }: { children: ReactNode }) => {
  const { data, tools } = usePending();
  return (
    <div
      className="pending-region"
      aria-busy={data || tools}
      data-pending={data ? "data" : tools ? "tools" : undefined}
    >
      <p role="status" className="sr-only">
        {data || tools ? "Loading…" : ""}
      </p>
      {children}
    </div>
  );
};

/** A link that changes only the query: the page stays, marked stale, until the new one is ready. */
export const PendingLink = ({ href, ...props }: ComponentProps<typeof Link> & { href: string }) => {
  const router = useRouter();
  const { startTransition: start } = usePending();
  return (
    <Link
      href={href}
      scroll={false}
      {...props}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        event.preventDefault();
        start(() => router.push(href, { scroll: false }));
      }}
    />
  );
};
