"use client";

import { useRef } from "react";
import { WithLocation } from "@/components/with-location";
import { DropdownMenu } from "radix-ui";
import { CheckIcon, ChevronRightIcon, CircleAlertIcon, CopyIcon, TerminalIcon } from "lucide-react";
import { Claude } from "@/components/icons/claude";
import { Markdown } from "@/components/icons/markdown";
import { OpenAI } from "@/components/icons/openai";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";

/*
 * The docs' Copy Page (vltpkg/www/docs/src/components/copy-page.tsx), ported. What differs: the
 * markdown twin is this view's, query and all (`/package-managers/clean.md?fixture=astro`), read from
 * the router so it follows client-side navigation and nuqs' URL updates; and a failure shows on the
 * button, not in a toast.
 */

export const item =
  "text-muted-foreground flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm outline-none data-highlighted:bg-foreground/5 data-highlighted:text-foreground [&_svg]:size-4";

/** Open in Claude, ChatGPT and Claude Code, each started on a prompt. Shared with the agent prompt. */
export const LaunchItems = ({ prompt, cli = prompt }: { prompt: string; cli?: string }) => {
  const q = encodeURIComponent(prompt);
  return (
    <>
      <DropdownMenu.Item asChild className={item}>
        <a href={`https://claude.ai/new?q=${q}`} target="_blank" rel="noopener noreferrer">
          <Claude aria-hidden />
          Open in Claude
        </a>
      </DropdownMenu.Item>
      <DropdownMenu.Item asChild className={item}>
        <a
          href={`https://chatgpt.com/?hints=search&q=${q}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <OpenAI aria-hidden />
          Open in ChatGPT
        </a>
      </DropdownMenu.Item>
      <DropdownMenu.Item asChild className={item}>
        <a href={`claude-cli://open?q=${encodeURIComponent(cli)}`}>
          <TerminalIcon aria-hidden />
          Open in Claude Code
        </a>
      </DropdownMenu.Item>
    </>
  );
};

// prompts stay short and link to the markdown twin: query strings get long fast (claude-cli:// caps q at 5,000 chars).
// rendered only inside the open menu, so reading the origin never runs on the server
const AiActions = ({ path }: { path: string }) => {
  const md = `${window.location.origin}${path}`;
  return (
    <>
      <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border-illustration" />
      {/* claude-cli://open starts in the home directory, so have it ask for the project first */}
      <LaunchItems
        prompt={`Read ${md} so I can ask questions about it.`}
        cli={`Read ${md} from the vlt benchmarks. Before changing anything, ask me which project to work in.`}
      />
    </>
  );
};

// a split button in the docs' code card's dress: the card is the frame, the copy action its inset panel, its
// corners the frame's radius less the padding. the view's `.md` twin (see next.config.ts rewrites) is what gets
// copied, viewed and linked
export const CopyPage = () => (
  <WithLocation>
    {({ pathname, query }) => <Copy pathname={pathname ?? ""} query={query} />}
  </WithLocation>
);

const Copy = ({ pathname, query }: { pathname: string; query: string }) => {
  const path = `${pathname}.md${query ? `?${query}` : ""}`;
  const { status, copy } = useCopy(1500);
  const markdown = useRef<{ path: string; text: Promise<string> }>(null);

  // fetch on hover/focus so the copy only awaits an already-settled promise;
  // Safari drops clipboard writes that happen too long after the click
  // a failed fetch is forgotten, so the next hover or click retries instead of reusing it; so is another view's
  const load = () => {
    if (markdown.current?.path !== path) {
      const entry = {
        path,
        text: fetch(path).then((res) => {
          if (!res.ok) throw new Error(`${path}: ${res.status}`);
          return res.text();
        }),
      };
      entry.text.catch(() => {
        if (markdown.current === entry) markdown.current = null;
      });
      markdown.current = entry;
    }
    return markdown.current.text;
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-card p-0.5 shadow-lg ring-1 shadow-black/6.5 ring-border-illustration">
      <Button
        variant="outline"
        size="sm"
        onPointerEnter={load}
        onFocus={load}
        onClick={() => void copy(load())}
        className="rounded-[calc(var(--radius-xl)-2px)] bg-illustration text-foreground/75 hover:text-foreground"
      >
        {status === "copied" ? (
          <CheckIcon aria-hidden />
        ) : status === "failed" ? (
          <CircleAlertIcon aria-hidden className="text-destructive" />
        ) : (
          <CopyIcon aria-hidden />
        )}
        {/* the label keeps its width (only the icon confirms; the live region says it), so the frame never resizes */}
        Copy Page
      </Button>
      <span role="status" className="sr-only">
        {status === "copied" ? "Page copied" : status === "failed" ? "Could not copy the page" : ""}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="More page actions"
            className="group/button rounded-[calc(var(--radius-xl)-2px)] text-muted-foreground data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground"
          >
            <ChevronRightIcon
              aria-hidden
              className="transition-transform duration-200 ease-out group-data-[state=open]/button:rotate-90 motion-reduce:transition-none"
            />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-52 rounded-xl bg-card p-1 shadow-lg ring-1 shadow-black/6.5 ring-border-illustration data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Item asChild className={item}>
              <a href={path} target="_blank" rel="noopener noreferrer">
                <Markdown aria-hidden />
                View as Markdown
              </a>
            </DropdownMenu.Item>
            <AiActions path={path} />
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};
