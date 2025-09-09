import { Button } from "@/components/ui/button";
import { useYAxis } from "@/contexts/y-axis-context";
import { RulerDimensionLine } from "lucide-react";
import { cn } from "@/lib/utils";

export const YAxisToggle = () => {
  const { isConsistentYAxis, setIsConsistentYAxis } = useYAxis();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsConsistentYAxis(!isConsistentYAxis)}
      className={cn(
        "cursor-default text-sm rounded-lg shadow-none bg-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700 dark:bg-transparent hover:border-neutral-300 dark:hover:border-neutral-500 border-neutral-200 dark:border-neutral-600 text-black dark:text-white w-fit max-w-full",
        isConsistentYAxis &&
          "dark:bg-neutral-600 border-neutral-300 dark:border-neutral-500 bg-neutral-200",
      )}
      title={
        isConsistentYAxis
          ? "Disable consistent Y-axis scaling across variations"
          : "Enable consistent Y-axis scaling across variations"
      }
    >
      <RulerDimensionLine size={14} />
      {isConsistentYAxis ? "Consistent Scale" : "Auto Scale"}
    </Button>
  );
};
