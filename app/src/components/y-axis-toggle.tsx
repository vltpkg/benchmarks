import { Button } from "@/components/ui/button";
import { useYAxis } from "@/contexts/y-axis-context";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export const YAxisToggle = () => {
  const { isConsistentYAxis, setIsConsistentYAxis } = useYAxis();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setIsConsistentYAxis(!isConsistentYAxis)}
      className={cn(
        "gap-2 text-xs",
        isConsistentYAxis && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
      )}
      title={
        isConsistentYAxis
          ? "Disable consistent Y-axis scaling across variations"
          : "Enable consistent Y-axis scaling across variations"
      }
    >
      <BarChart3 size={14} />
      {isConsistentYAxis ? "Consistent Scale" : "Auto Scale"}
    </Button>
  );
};
