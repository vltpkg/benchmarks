import React, { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// Aube icon — dark version for light mode backgrounds (dark bg with light sunrise)
const AubeDark = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      {...props}
    >
      <rect width="512" height="512" rx="112" fill="#0d0a09" />
      <path
        d="M116 326H396"
        stroke="#f4f0e8"
        strokeWidth="32"
        strokeLinecap="round"
      />
      <path
        d="M174 326A82 82 0 0 1 338 326"
        stroke="#f4f0e8"
        strokeWidth="32"
        strokeLinecap="round"
      />
    </svg>
  ),
);
AubeDark.displayName = "AubeDark";

// Aube icon — light version for dark mode backgrounds (light bg with dark sunrise)
const AubeLight = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      {...props}
    >
      <rect width="512" height="512" rx="112" fill="#f4f0e8" />
      <path
        d="M116 326H396"
        stroke="#0d0a09"
        strokeWidth="32"
        strokeLinecap="round"
      />
      <path
        d="M174 326A82 82 0 0 1 338 326"
        stroke="#0d0a09"
        strokeWidth="32"
        strokeLinecap="round"
      />
    </svg>
  ),
);
AubeLight.displayName = "AubeLight";

// Combined Aube icon that switches between light/dark variants
export const Aube = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <span ref={ref as React.Ref<HTMLSpanElement>} className="inline-flex">
      <AubeDark
        size={size}
        className={`block dark:hidden ${className || ""}`}
        {...props}
      />
      <AubeLight
        size={size}
        className={`hidden dark:block ${className || ""}`}
        {...props}
      />
    </span>
  ),
);

Aube.displayName = "Aube";
