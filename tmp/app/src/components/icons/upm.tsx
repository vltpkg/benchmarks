import React, { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// upm icon — dark version for light mode backgrounds
const UpmDark = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 197.9 67.5"
      fill="none"
      className={className}
      {...props}
    >
      <rect width="197.9" height="67.5" rx="12" fill="#ffffff" />
      <path
        d="M51.3 0V54H12.5L0 41.5V0H18.7V37.8H32.6V0ZM58.8 67.5V0H97.7L111 13.3V40.7L97.7 54H77.5V67.5ZM92.3 15.4H77.5V38.6H92.3ZM117.6 0H185.1L197.9 12.7V54H179.6V15H166.7V54H148.8V15H136V54H117.6Z"
        fill="#000000"
        transform="translate(0, 6.75) scale(0.9)"
      />
    </svg>
  ),
);
UpmDark.displayName = "UpmDark";

// upm icon — light version for dark mode backgrounds
const UpmLight = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 197.9 67.5"
      fill="none"
      className={className}
      {...props}
    >
      <rect width="197.9" height="67.5" rx="12" fill="#1a1a1a" />
      <path
        d="M51.3 0V54H12.5L0 41.5V0H18.7V37.8H32.6V0ZM58.8 67.5V0H97.7L111 13.3V40.7L97.7 54H77.5V67.5ZM92.3 15.4H77.5V38.6H92.3ZM117.6 0H185.1L197.9 12.7V54H179.6V15H166.7V54H148.8V15H136V54H117.6Z"
        fill="#ffffff"
        transform="translate(0, 6.75) scale(0.9)"
      />
    </svg>
  ),
);
UpmLight.displayName = "UpmLight";

// Combined upm icon that switches between light/dark variants
export const Upm = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <span ref={ref as React.Ref<HTMLSpanElement>} className="inline-flex">
      <UpmDark
        size={size}
        className={`block dark:hidden ${className || ""}`}
        {...props}
      />
      <UpmLight
        size={size}
        className={`hidden dark:block ${className || ""}`}
        {...props}
      />
    </span>
  ),
);

Upm.displayName = "Upm";
