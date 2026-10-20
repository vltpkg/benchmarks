"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The docs' `useCopy` (vltpkg/www/docs/src/hooks/use-copy.tsx), without their
 * sonner toasts: the outcome is returned as `status` for the button to show,
 * and resets after `duration`. `copy` also takes a promise, so a failed fetch
 * and a refused clipboard write are one failure.
 */
export const useCopy = (duration = 3000) => {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const copy = useCallback(
    async (v: string | Promise<string>): Promise<void> => {
      let next: "copied" | "failed" = "copied";
      try {
        if (!("clipboard" in navigator) || !window.isSecureContext)
          throw new Error("Clipboard is unavailable");
        await navigator.clipboard.writeText(await v);
      } catch {
        next = "failed";
      }
      setStatus(next);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setStatus("idle"), duration);
    },
    [duration],
  );

  return { status, copy };
};
