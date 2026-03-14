import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// Vite+ (vp) icon — uses different SVG paths for light/dark mode
// Light mode: dark logo (for light backgrounds)
// Dark mode: light logo (for dark backgrounds)
export const Vp = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      {...props}
    >
      {/* Placeholder: bolt/lightning shape representing Vite+ */}
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        fill="currentColor"
        strokeWidth="0"
      />
    </svg>
  ),
);

Vp.displayName = "Vp";
