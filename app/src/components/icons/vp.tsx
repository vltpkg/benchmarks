import React, { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

// Vite+ (vp) icon — dark version for light mode backgrounds
const VpDark = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={typeof size === "number" ? (size * 15) / 25 : size}
      viewBox="0 0 25 15"
      fill="none"
      className={className}
      {...props}
    >
      <mask id="vp-dark-mask0" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="4" y="0" width="16" height="15">
        <path d="M12.8382 14.6538C12.6255 14.9246 12.1905 14.774 12.1905 14.4301V11.1269C12.1905 10.7264 11.8659 10.4018 11.4653 10.4018H7.81833C7.52343 10.4018 7.35143 10.0682 7.52343 9.82859L9.92113 6.47157C10.2644 5.9916 9.92113 5.32448 9.33073 5.32448H4.91702C4.62212 5.32448 4.45023 4.99092 4.62213 4.75128L7.73053 0.399095C7.79893 0.303791 7.90873 0.247162 8.02543 0.247162H17.2885C17.5834 0.247162 17.7553 0.580723 17.5834 0.820363L15.1856 4.17739C14.8424 4.65735 15.1856 5.32448 15.7761 5.32448H19.4232C19.7256 5.32448 19.8955 5.67323 19.7084 5.91149L12.8382 14.6538Z" fill="black" />
      </mask>
      <g mask="url(#vp-dark-mask0)">
        <g filter="url(#vp-dark-f0)"><path d="M12.5549 12.086C12.558 13.0613 10.4501 13.8587 7.84658 13.8671C5.24311 13.8756 3.13001 13.0918 3.12685 12.1166C3.12369 11.1414 5.23166 10.344 7.83513 10.3355C10.4386 10.3271 12.5517 11.1108 12.5549 12.086Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-dark-f1)"><path d="M11.0961 6.04618C11.1021 7.88747 6.8223 9.39401 1.53694 9.41114C-3.74842 9.42828 -8.03789 7.94951 -8.04386 6.10822C-8.04983 4.26693 -3.77004 2.76039 1.51532 2.74326C6.80068 2.72613 11.0902 4.20489 11.0961 6.04618Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-dark-f2)"><path d="M11.1332 5.57904C11.1364 6.55427 6.76313 7.35903 1.36527 7.37652C-4.03259 7.39402 -8.41098 6.61763 -8.41414 5.6424C-8.41731 4.66718 -4.04404 3.86242 1.35382 3.84492C6.75168 3.82743 11.1301 4.60382 11.1332 5.57904Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f3)"><path d="M12.6785 11.3492C12.6817 12.3244 8.29235 13.1292 2.8747 13.1468C-2.54295 13.1644 -6.93739 12.388 -6.94055 11.4128C-6.94371 10.4376 -2.5544 9.63275 2.86325 9.61519C8.2809 9.59763 12.6753 10.374 12.6785 11.3492Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f4)"><path d="M13.1697 11.7175C13.1729 12.6927 8.78355 13.4976 3.3659 13.5151C-2.05175 13.5327 -6.44619 12.7563 -6.44935 11.7811C-6.45251 10.8059 -2.0632 10.0011 3.35445 9.98351C8.7721 9.96595 13.1665 10.7423 13.1697 11.7175Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f5)"><path d="M14.5214 3.52838C14.667 1.0412 17.9486 -0.789835 21.851 -0.561344C25.7535 -0.332852 28.7989 1.86864 28.6533 4.35582C28.5077 6.84301 25.2261 8.67404 21.3237 8.44555C17.4212 8.21706 14.3757 6.01557 14.5214 3.52838Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-dark-f6)"><path d="M15.0494 5.16394C15.0388 4.54958 18.1158 3.99817 21.9221 3.93231C25.7284 3.86646 28.8226 4.31111 28.8333 4.92546C28.8439 5.53981 25.7669 6.09123 21.9606 6.15708C18.1543 6.22293 15.0601 5.77829 15.0494 5.16394Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f7)"><path d="M15.0494 5.16394C15.0388 4.54958 18.1158 3.99817 21.9221 3.93231C25.7284 3.86646 28.8226 4.31111 28.8333 4.92546C28.8439 5.53981 25.7669 6.09123 21.9606 6.15708C18.1543 6.22293 15.0601 5.77829 15.0494 5.16394Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f8)"><path d="M-1.25949 10.3228C-0.657532 10.8192 2.4885 7.9983 5.76737 4.02216C9.04624 0.0460307 11.2163 -3.57967 10.6144 -4.07606C10.0124 -4.57246 6.86637 -1.75158 3.5875 2.22456C0.308625 6.20069 -1.86144 9.82639 -1.25949 10.3228Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f9)"><path d="M14.0577 5.65842C14.6734 6.13762 17.7385 3.22903 20.9038 -0.838099C24.0691 -4.90523 26.1359 -8.59075 25.5202 -9.06995C24.9045 -9.54915 21.8393 -6.64056 18.674 -2.57343C15.5088 1.49369 13.4419 5.17922 14.0577 5.65842Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f10)"><path d="M15.9274 4.72289C16.7618 5.37226 18.2902 4.80389 19.3412 3.4534C20.3922 2.10291 20.5679 0.481711 19.7335 -0.167657C18.8991 -0.817025 17.3707 -0.248659 16.3196 1.10183C15.2686 2.45231 15.093 4.07352 15.9274 4.72289Z" fill="#47BFFF" /></g>
        <g filter="url(#vp-dark-f11)"><path d="M-1.78025 19.9002C-1.16452 20.3794 1.90061 17.4708 5.06591 13.4037C8.2312 9.33653 10.298 5.65101 9.6823 5.17181C9.06657 4.69261 6.00145 7.6012 2.83615 11.6683C-0.329144 15.7355 -2.39598 19.421 -1.78025 19.9002Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f12)"><path d="M-1.78025 19.9002C-1.16452 20.3794 1.90061 17.4708 5.06591 13.4037C8.2312 9.33653 10.298 5.65101 9.6823 5.17181C9.06657 4.69261 6.00145 7.6012 2.83615 11.6683C-0.329144 15.7355 -2.39598 19.421 -1.78025 19.9002Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f13)"><path d="M10.2519 17.1992C10.8677 17.6784 13.9328 14.7698 17.0981 10.7026C20.2634 6.63552 22.3302 2.94999 21.7145 2.47079C21.0988 1.99159 18.0336 4.90018 14.8683 8.96731C11.7031 13.0344 9.63622 16.72 10.2519 17.1992Z" fill="#7E14FF" /></g>
        <g filter="url(#vp-dark-f14)"><path d="M13.8578 14.5045C14.6922 15.1539 16.7171 13.9475 18.3806 11.8101C20.0441 9.67261 20.7163 7.41344 19.8819 6.76407C19.0475 6.1147 17.0226 7.32104 15.3591 9.4585C13.6955 11.596 13.0234 13.8551 13.8578 14.5045Z" fill="#47BFFF" /></g>
      </g>
      <path d="M2.21813 0C-0.73077 4.22097 -0.74797 10.7637 2.21813 14.9999H4.21053C1.24513 10.7637 1.26233 4.22097 4.21053 0H2.21813Z" fill="#08060D" />
      <path d="M22.2307 1.52588e-05H20.2383C23.1871 4.22098 23.2044 10.7638 20.2383 14.9999H22.2307C25.1961 10.7638 25.1788 4.22098 22.2307 1.52588e-05Z" fill="#08060D" />
      <defs>
        <filter id="vp-dark-f0" x="-1.78411" y="5.42449" width="19.2499" height="13.3537" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45548" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f1" x="-12.9548" y="-2.16786" width="28.9619" height="16.4901" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45548" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f2" x="-11.3607" y="0.898055" width="25.4405" height="9.42534" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f3" x="-9.88713" y="6.66832" width="25.5122" height="9.42534" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f4" x="-9.39593" y="7.03664" width="25.5122" height="9.42534" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f5" x="9.60539" y="-5.49156" width="23.9639" height="18.8673" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45548" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f6" x="12.1028" y="0.979262" width="19.677" height="8.13086" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f7" x="12.1028" y="0.979262" width="19.677" height="8.13086" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f8" x="-4.30634" y="-7.0793" width="17.9676" height="20.4053" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f9" x="11.0026" y="-12.0682" width="17.5728" height="20.7248" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f10" x="12.4539" y="-3.38286" width="10.753" height="11.321" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f11" x="-4.83535" y="2.17357" width="17.5728" height="20.7248" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f12" x="-4.83535" y="2.17357" width="17.5728" height="20.7248" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f13" x="7.19685" y="-0.527452" width="17.5728" height="20.7248" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
        <filter id="vp-dark-f14" x="10.5528" y="3.64175" width="12.634" height="13.9851" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.47329" result="effect1_foregroundBlur_1_41" /></filter>
      </defs>
    </svg>
  ),
);
VpDark.displayName = "VpDark";

// Vite+ (vp) icon — white version for dark mode backgrounds
const VpLight = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={typeof size === "number" ? (size * 15) / 25 : size}
      viewBox="0 0 25 15"
      fill="none"
      className={className}
      {...props}
    >
      <mask id="vp-light-mask0" style={{ maskType: "alpha" }} maskUnits="userSpaceOnUse" x="4" y="0" width="16" height="15">
        <path d="M12.8725 14.654C12.6598 14.9247 12.2247 14.7742 12.2247 14.4303V11.1271C12.2247 10.7265 11.9001 10.4019 11.4996 10.4019H7.85247C7.55757 10.4019 7.38557 10.0684 7.55757 9.82872L9.95537 6.47167C10.2986 5.9917 9.95537 5.32457 9.36487 5.32457H4.95117C4.65637 5.32457 4.48437 4.99101 4.65637 4.75137L7.76477 0.399157C7.83307 0.303853 7.94297 0.247223 8.05967 0.247223H17.3228C17.6177 0.247223 17.7896 0.580787 17.6177 0.820428L15.2199 4.17747C14.8767 4.65744 15.2199 5.32457 15.8104 5.32457H19.4575C19.7599 5.32457 19.9298 5.67333 19.7427 5.91159L12.8725 14.654Z" fill="#833BFF" />
      </mask>
      <g mask="url(#vp-light-mask0)">
        <g filter="url(#vp-light-f0)"><path d="M12.5559 12.0861C12.559 13.0614 10.451 13.8588 7.84755 13.8672C5.24406 13.8757 3.13096 13.0919 3.12779 12.1167C3.12463 11.1415 5.23262 10.344 7.83611 10.3356C10.4396 10.3272 12.5527 11.1109 12.5559 12.0861Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-light-f1)"><path d="M11.0972 6.04622C11.1031 7.88751 6.82333 9.39407 1.53793 9.4112C-3.74746 9.42833 -8.03696 7.94955 -8.04293 6.10826C-8.0489 4.26696 -3.76908 2.7604 1.51632 2.74327C6.80171 2.72614 11.0912 4.20492 11.0972 6.04622Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-light-f2)"><path d="M11.1343 5.57908C11.1375 6.55431 6.76416 7.35908 1.36627 7.37657C-4.03163 7.39407 -8.41005 6.61767 -8.41321 5.64244C-8.41637 4.66721 -4.04307 3.86245 1.35482 3.84495C6.75271 3.82746 11.1311 4.60385 11.1343 5.57908Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f3)"><path d="M12.6796 11.3493C12.6827 12.3245 8.2934 13.1293 2.87571 13.1469C-2.54198 13.1644 -6.93644 12.3881 -6.9396 11.4129C-6.94277 10.4376 -2.55342 9.63281 2.86426 9.61525C8.28195 9.59769 12.6764 10.374 12.6796 11.3493Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f4)"><path d="M13.1708 11.7176C13.1739 12.6928 8.78459 13.4976 3.36691 13.5152C-2.05078 13.5328 -6.44525 12.7564 -6.44841 11.7812C-6.45157 10.806 -2.06223 10.0011 3.35546 9.98358C8.77315 9.96602 13.1676 10.7424 13.1708 11.7176Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f5)"><path d="M14.5221 3.52839C14.6677 1.04119 17.9494 -0.789854 21.8518 -0.561361C25.7543 -0.332868 28.7998 1.86864 28.6542 4.35584C28.5085 6.84304 25.2269 8.67408 21.3244 8.44559C17.422 8.2171 14.3765 6.01559 14.5221 3.52839Z" fill="#EDE6FF" /></g>
        <g filter="url(#vp-light-f6)"><path d="M15.0503 5.164C15.0397 4.54965 18.1167 3.99822 21.923 3.93237C25.7293 3.86652 28.8236 4.31117 28.8342 4.92552C28.8449 5.53988 25.7678 6.0913 21.9615 6.15716C18.1552 6.22301 15.0609 5.77836 15.0503 5.164Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f7)"><path d="M15.0503 5.164C15.0397 4.54965 18.1167 3.99822 21.923 3.93237C25.7293 3.86652 28.8236 4.31117 28.8342 4.92552C28.8449 5.53988 25.7678 6.0913 21.9615 6.15716C18.1552 6.22301 15.0609 5.77836 15.0503 5.164Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f8)"><path d="M-1.25859 10.3228C-0.656635 10.8192 2.48942 7.99835 5.76831 4.02219C9.0472 0.0460305 11.2173 -3.57969 10.6153 -4.07609C10.0134 -4.57249 6.86732 -1.75159 3.58843 2.22457C0.309534 6.20073 -1.86055 9.82645 -1.25859 10.3228Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f9)"><path d="M14.0585 5.65846C14.6742 6.13767 17.7393 3.22906 20.9047 -0.8381C24.07 -4.90525 26.1368 -8.5908 25.5211 -9.07001C24.9054 -9.54921 21.8402 -6.6406 18.6749 -2.57345C15.5096 1.49371 13.4427 5.17926 14.0585 5.65846Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f10)"><path d="M15.199 6.55569C16.3561 7.45621 18.3954 6.77117 19.7539 5.02563C21.1124 3.28008 21.2756 1.13502 20.1185 0.234501C18.9615 -0.666015 16.9222 0.0190208 15.5637 1.76457C14.2052 3.51012 14.0419 5.65518 15.199 6.55569Z" fill="#2BFDD2" /></g>
        <g filter="url(#vp-light-f11)"><path d="M-1.77934 19.9003C-1.16361 20.3795 1.90154 17.4709 5.06686 13.4038C8.23217 9.3366 10.299 5.65104 9.68328 5.17184C9.06754 4.69264 6.0024 7.60125 2.83708 11.6684C-0.328233 15.7356 -2.39508 19.4211 -1.77934 19.9003Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f12)"><path d="M-1.77934 19.9003C-1.16361 20.3795 1.90154 17.4709 5.06686 13.4038C8.23217 9.3366 10.299 5.65104 9.68328 5.17184C9.06754 4.69264 6.0024 7.60125 2.83708 11.6684C-0.328233 15.7356 -2.39508 19.4211 -1.77934 19.9003Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f13)"><path d="M10.183 17.145C10.8372 17.6542 13.9336 14.7699 17.0989 10.7027C20.2643 6.63557 22.2999 2.92571 21.6456 2.41651C20.9913 1.90731 17.8949 4.7916 14.7296 8.85876C11.5643 12.9259 9.52868 16.6358 10.183 17.145Z" fill="#4E14FF" /></g>
        <g filter="url(#vp-light-f14)"><path d="M13.2007 16.1568C14.3244 17.0313 17.0924 15.354 19.3832 12.4105C21.674 9.46703 22.6201 6.37192 21.4965 5.4974C20.3728 4.62288 17.6048 6.30012 15.314 9.24362C13.0231 12.1871 12.077 15.2822 13.2007 16.1568Z" fill="#2BFDD2" /></g>
      </g>
      <path d="M2.21817 0C-0.730733 4.221 -0.748033 10.7638 2.21817 15H4.21057C1.24507 10.7638 1.26237 4.221 4.21057 0H2.21817Z" fill="white" />
      <path d="M22.2305 0H20.2383C23.1875 4.221 23.2045 10.7638 20.2383 15H22.2305C25.1965 10.7638 25.1785 4.221 22.2305 0Z" fill="white" />
      <defs>
        <filter id="vp-light-f0" x="-1.78319" y="5.42455" width="19.25" height="13.3537" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45549" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f1" x="-12.9539" y="-2.16786" width="28.9621" height="16.4902" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45549" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f2" x="-11.3598" y="0.898066" width="25.4407" height="9.4254" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f3" x="-9.88621" y="6.66836" width="25.5124" height="9.42541" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f4" x="-9.39501" y="7.03669" width="25.5124" height="9.42541" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f5" x="9.60611" y="-5.49159" width="23.964" height="18.8674" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="2.45549" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f6" x="12.1037" y="0.979303" width="19.6772" height="8.13092" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f7" x="12.1037" y="0.979303" width="19.6772" height="8.13092" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f8" x="-4.30547" y="-7.07935" width="17.9677" height="20.4055" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f9" x="11.0033" y="-12.0683" width="17.5729" height="20.725" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f10" x="11.481" y="-3.10865" width="12.3555" height="13.0075" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f11" x="-4.83447" y="2.17359" width="17.5729" height="20.725" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f12" x="-4.83447" y="2.17359" width="17.5729" height="20.725" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f13" x="7.11403" y="-0.588369" width="17.6005" height="20.7382" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
        <filter id="vp-light-f14" x="9.78091" y="2.31909" width="15.1353" height="17.016" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB"><feFlood floodOpacity="0" result="BackgroundImageFix" /><feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" /><feGaussianBlur stdDeviation="1.4733" result="effect1_foregroundBlur_1_81" /></filter>
      </defs>
    </svg>
  ),
);
VpLight.displayName = "VpLight";

// Combined Vite+ icon that switches between light/dark variants
// Uses CSS classes to show the correct variant based on theme
export const Vp = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, className, ...props }, ref) => (
    <span ref={ref as React.Ref<HTMLSpanElement>} className="inline-flex">
      <VpDark
        size={size}
        className={`block dark:hidden ${className || ""}`}
        {...props}
      />
      <VpLight
        size={size}
        className={`hidden dark:block ${className || ""}`}
        {...props}
      />
    </span>
  ),
);

Vp.displayName = "Vp";
