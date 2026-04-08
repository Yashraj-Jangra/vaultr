"use client";

import { useEffect, useRef, useCallback } from "react";

type AutoLockOptions = {
  timeoutMinutes: number; // 0 = disabled
  onLock: () => void;
  onWarn?: () => void;    // called 30s before locking
};

export function useAutoLock({ timeoutMinutes, onLock, onWarn }: AutoLockOptions) {
  const lockTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (lockTimer.current)  clearTimeout(lockTimer.current);
    if (warnTimer.current)  clearTimeout(warnTimer.current);

    if (timeoutMinutes === 0) return;

    const lockMs = timeoutMinutes * 60 * 1000;
    const warnMs = lockMs - 30_000;

    if (warnMs > 0 && onWarn) {
      warnTimer.current = setTimeout(onWarn, warnMs);
    }
    lockTimer.current = setTimeout(onLock, lockMs);
  }, [timeoutMinutes, onLock, onWarn]);

  useEffect(() => {
    if (timeoutMinutes === 0) return;

    reset();

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (lockTimer.current)  clearTimeout(lockTimer.current);
      if (warnTimer.current)  clearTimeout(warnTimer.current);
    };
  }, [timeoutMinutes, reset]);
}
