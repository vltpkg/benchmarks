import { ThemeSwitcher } from "@/components/theme-switcher";
import { Vlt } from "@/components/icons/vlt";

export const Footer = () => {
  return (
    <footer className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex justify-between items-center">
        <Vlt className="h-6 w-6 text-muted-foreground" />
        <ThemeSwitcher />
      </div>
    </footer>
  );
};

