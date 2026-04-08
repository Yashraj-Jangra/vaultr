"use client";

import { useEffect } from "react";

type Shortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  /** Don't fire when user is typing in an input/textarea */
  ignoreWhenTyping?: boolean;
};

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const sc of shortcuts) {
        const keyMatch   = e.key.toLowerCase() === sc.key.toLowerCase();
        const ctrlMatch  = sc.ctrl  ? (e.ctrlKey || e.metaKey) : true;
        const metaMatch  = sc.meta  ? e.metaKey  : true;
        const shiftMatch = sc.shift ? e.shiftKey : true;

        if (!keyMatch || !ctrlMatch || !metaMatch || !shiftMatch) continue;

        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement;

        if (sc.ignoreWhenTyping !== false && isTyping) continue;

        e.preventDefault();
        sc.handler();
        break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
