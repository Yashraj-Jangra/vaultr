"use client";

import { useState, useCallback } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => {
      const next = [...prev, { id, message, variant }];
      // Keep max 3 visible at once
      return next.slice(-3);
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast(msg, "success"),
    error:   (msg: string) => addToast(msg, "error"),
    warning: (msg: string) => addToast(msg, "warning"),
    info:    (msg: string) => addToast(msg, "info"),
  };

  return { toasts, toast, removeToast };
}
