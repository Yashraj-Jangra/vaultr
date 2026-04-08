"use client";

import React from "react";
import { Check, X, AlertTriangle, Info, CheckCircle, AlertCircle } from "lucide-react";
import { Toast, ToastVariant } from "@/hooks/useToast";

const STYLES: Record<ToastVariant, { bar: string; icon: React.ReactNode }> = {
  success: {
    bar: "bg-emerald-500",
    icon: <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />,
  },
  error: {
    bar: "bg-red-500",
    icon: <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />,
  },
  warning: {
    bar: "bg-amber-500",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
  },
  info: {
    bar: "bg-neutral-500",
    icon: <Info className="w-4 h-4 text-neutral-400 shrink-0" />,
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const styles = STYLES[toast.variant];
  return (
    <div
      className="relative flex items-center gap-3 bg-neutral-900 border border-[var(--border)] rounded-lg px-4 py-3 shadow-lg overflow-hidden min-w-[260px] max-w-[340px] animate-in slide-in-from-bottom-2 fade-in duration-200"
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${styles.bar}`} />
      {styles.icon}
      <span className="flex-1 text-[13px] text-neutral-200 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-neutral-600 hover:text-neutral-300 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      {/* Auto-dismiss progress bar */}
      <div className={`absolute bottom-0 left-0 right-0 h-px ${styles.bar} opacity-40 animate-[shrink_3.5s_linear_forwards]`} />
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

// Dummy export to keep Check import used (in case needed later)
const _check = Check;
export { _check as _CheckIcon };
