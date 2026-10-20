import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LaptopMinimal, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

import type { LucideIcon } from "lucide-react";

export type Theme = "system" | "light" | "dark";

const renderIcon = (theme: Theme): LucideIcon => {
  switch (theme) {
    case "system":
      return LaptopMinimal;
    case "light":
      return Sun;
    case "dark":
      return Moon;
  }
};

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();
  const DisplayIcon = renderIcon(theme);

  const themes: { ariaLabel: Theme; name: Theme }[] = [
    {
      ariaLabel: "system",
      name: "system",
    },
    {
      ariaLabel: "light",
      name: "light",
    },
    {
      ariaLabel: "dark",
      name: "dark",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="transition-colors duration-250 [&>svg]:stroke-neutral-500 [&>svg]:transition-all [&>svg]:duration-250 [&>svg]:fill-neutral-500 [&>svg]:hover:fill-foreground [&>svg]:hover:stroke-foreground w-[90px] text-neutral-500 hover:text-primary focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-background focus-visible:outline-none cursor-default px-2 py-1 inline-flex justify-center items-center gap-2 text-sm font-medium data-[state=open]:bg-neutral-200 dark:data-[state=open]:bg-secondary data-[state=open]:text-foreground [&>svg]:data-[state=open]:stroke-foreground [&>svg]:data-[state=open]:fill-foreground hover:bg-neutral-200 dark:hover:bg-secondary rounded-md transition-all duration-250">
          <DisplayIcon className="size-4" />
          <span className="capitalize">{theme ?? "System"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="rounded-lg shadow-sm"
      >
        {themes.map((t) => {
          const Icon = renderIcon(t.name);

          return (
            <DropdownMenuItem
              onClick={() => setTheme(t.name)}
              className={cn(
                "relative text-sm font-medium capitalize",
                t.name === theme &&
                  "bg-neutral-200/40 dark:hover:text-white dark:bg-neutral-800/80",
              )}
              key={t.name}
            >
              <Icon className="size-4 text-neutral-400 fill-neutral-400" />
              {t.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
