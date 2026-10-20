"use client";

import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useId, useState } from "react";
import { CodeCard } from "@/components/code-card";
import { LaunchItems } from "@/components/copy-page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * The docs' agent prompt (vltpkg/www/docs/src/components/agent-prompt.tsx), ported. Added: an
 * "Open in" menu beside copy, the Copy Page menu's launch items started on this prompt.
 */

// a CodeCard set as prose, clamped to a couple of lines until expanded
export const AgentPrompt = ({ prompt }: { prompt: string }) => {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div>
      <CodeCard
        id={id}
        tabs={[
          {
            code: prompt,
            title: "Agent prompt",
            // clamp + fade the text, not the <pre>, so the panel keeps its border and corners
            content: (
              <span
                className={cn(
                  "block",
                  !open &&
                    "max-h-20 overflow-hidden [mask-image:linear-gradient(to_bottom,black_30%,transparent)]",
                )}
              >
                {prompt}
              </span>
            ),
          },
        ]}
        actions={
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group/button text-muted-foreground data-[state=open]:bg-foreground/5 data-[state=open]:text-foreground"
              >
                Open in
                <ChevronDownIcon
                  aria-hidden
                  className="transition-transform duration-200 ease-out group-data-[state=open]/button:rotate-180 motion-reduce:transition-none"
                />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 min-w-52 rounded-xl bg-card p-1 shadow-lg ring-1 shadow-black/6.5 ring-border-illustration data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
              >
                <LaunchItems prompt={prompt} />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        }
        className="font-sans text-(length:--text-body) leading-relaxed whitespace-pre-wrap text-muted-foreground"
      />
      <div className="relative -mt-3.5 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className="h-7 rounded-full bg-background px-3 text-[0.8rem] dark:bg-background dark:hover:bg-muted"
        >
          {open ? "Show less" : "Show more"}
        </Button>
      </div>
    </div>
  );
};
