import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

export const Node = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 256 292"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="node-grad-1" x1="68.19%" y1="17.49%" x2="27.82%" y2="89.76%">
          <stop stopColor="#41873F" offset="0%" />
          <stop stopColor="#418B3D" offset="32.88%" />
          <stop stopColor="#419637" offset="63.52%" />
          <stop stopColor="#3FA92D" offset="93.19%" />
          <stop stopColor="#3FAE2A" offset="100%" />
        </linearGradient>
        <linearGradient id="node-grad-2" x1="43.28%" y1="55.17%" x2="159.25%" y2="-18.31%">
          <stop stopColor="#41873F" offset="13.76%" />
          <stop stopColor="#54A044" offset="40.32%" />
          <stop stopColor="#66B848" offset="71.36%" />
          <stop stopColor="#6CC04A" offset="90.81%" />
        </linearGradient>
        <linearGradient id="node-grad-3" x1="-4.39%" y1="50%" x2="101.5%" y2="50%">
          <stop stopColor="#6CC04A" offset="9.19%" />
          <stop stopColor="#66B848" offset="28.64%" />
          <stop stopColor="#54A044" offset="59.68%" />
          <stop stopColor="#41873F" offset="86.24%" />
        </linearGradient>
      </defs>
      <path
        d="M134.923 1.832C130.579-.611 125.421-.611 121.077 1.832L6.787 67.801C2.443 70.244 0 74.859 0 79.745v132.208c0 4.887 2.715 9.502 6.787 11.945l114.29 65.968c4.344 2.444 9.502 2.444 13.846 0l114.29-65.968c4.344-2.443 6.787-7.058 6.787-11.945V79.745c0-4.886-2.715-9.501-6.787-11.944L134.923 1.832z"
        fill="url(#node-grad-1)"
      />
      <path
        d="M249.485 67.8L134.651 1.833c-1.086-.543-2.443-1.086-3.529-1.358L2.443 220.912a10.9 10.9 0 003.8 3.258l114.834 65.968c3.258 1.9 7.058 2.443 10.588 1.357l120.806-220.453a10.658 10.658 0 00-2.986-3.242z"
        fill="url(#node-grad-2)"
      />
      <path
        d="M249.756 223.898c3.258-1.9 5.701-5.158 6.787-8.687L130.579.204c-3.258-.543-6.787-.271-9.773 1.628L6.787 67.53l122.978 224.237c1.629-.272 3.529-.814 5.158-1.628l114.833-66.241z"
        fill="url(#node-grad-3)"
      />
    </svg>
  ),
);

Node.displayName = "Node";
