import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { LaptopMinimal, type LucideProps, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export type Theme = "system" | "light" | "dark";

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

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

  const renderIcon = (): React.ReactNode => {
    const themeProps: LucideProps = {
      size: 16,
    };

    return theme === "system" ? (
      <LaptopMinimal {...themeProps} />
    ) : theme === "light" ? (
      <Sun {...themeProps} />
    ) : (
      <Moon {...themeProps} />
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="transition-colors duration-250 [&>svg]:stroke-neutral-500 [&>svg]:transition-all [&>svg]:duration-250 [&>svg]:fill-neutral-500 [&>svg]:hover:fill-foreground [&>svg]:hover:stroke-foreground w-[90px] text-neutral-500 hover:text-primary focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 ring-offset-background focus-visible:outline-none cursor-default px-2 py-1 inline-flex justify-center items-center gap-2 text-sm font-medium data-[state=open]:bg-neutral-200 dark:data-[state=open]:bg-secondary data-[state=open]:text-foreground [&>svg]:data-[state=open]:stroke-foreground [&>svg]:data-[state=open]:fill-foreground hover:bg-neutral-200 dark:hover:bg-secondary rounded-md transition-all duration-250">
          {renderIcon()}
          <span className="capitalize">{theme ?? "System"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {themes.map((t) => (
          <DropdownMenuItem
            onClick={() => setTheme(t.name)}
            className={cn(
              "relative text-sm font-medium capitalize",
              t.name === theme
                ? "bg-neutral-200/40 dark:bg-neutral-800/80"
                : "",
            )}
            key={t.name}
          >
            {t.name === "system" && <LaptopMinimal className="mr-2 h-4 w-4" />}
            {t.name === "light" && <Sun className="mr-2 h-4 w-4" />}
            {t.name === "dark" && <Moon className="mr-2 h-4 w-4" />}
            {t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { ThemeSwitcher };
