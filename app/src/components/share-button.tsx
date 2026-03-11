import { useState } from "react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { Share } from "@/components/icons";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const createDeepLink = (
  baseRoute: string,
  variation: string,
  section?: string,
  fixture?: string,
): string => {
  let path = `/${baseRoute}/${variation}`;
  if (section) {
    path += `/${section}`;
  }
  if (fixture) {
    path += `/${fixture}`;
  }

  return path;
};

interface ShareButtonProps
  extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  variation: string;
  section?: string;
  fixture?: string;
  label?: string;
}

export const ShareButton = ({
  variation,
  section,
  fixture,
  size = "sm",
  variant = "outline",
  className,
}: ShareButtonProps) => {
  const [copied, setCopied] = useState<boolean>(false);
  const location = useLocation();
  const Icon = copied ? Check : Share;

  const handleShare = async () => {
    // Extract the base route (package-managers, task-runners, registries) from the current path
    const baseRoute = location.pathname.split("/")[1] || "package-managers";
    const deepLink = createDeepLink(baseRoute, variation, section, fixture);
    const url = `${window.location.origin}${window.location.pathname}#${deepLink}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      setCopied(true);
      toast("Failed to copy link");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <Button
            onClick={handleShare}
            size={size}
            variant={variant}
            className={cn(
              "hover:[&_svg]:text-foreground [&_svg]:text-muted-foreground transition-all duration-250",
              className,
            )}
          >
            <div className="flex w-4 items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? "icon-check" : "icon-share"}
                  initial={{ opacity: 0, scale: 0.8, filter: "blur(1px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.8, filter: "blur(1px)" }}
                  transition={{
                    type: "spring",
                    duration: 0.175,
                    bounce: 0.2,
                  }}
                >
                  <Icon className="transition-colors duration-250 size-4 my-auto" />
                </motion.span>
              </AnimatePresence>
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm font-medium">Copy link to clipboard</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
