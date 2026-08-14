"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, X } from "lucide-react";

interface ConfirmDeleteModalProps {
  open: boolean;
  itemName: string;
  itemTemplate?: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDeleteModal({
  open,
  itemName,
  itemTemplate,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="w-full max-w-[420px] bg-neutral-950/95 border border-neutral-800/90 rounded-3xl p-7 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-center relative overflow-hidden backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/80 transition-colors cursor-pointer disabled:opacity-50 z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero SVG Illustration with Ambient Red Glow */}
        <div className="relative w-56 h-36 mx-auto flex items-center justify-center pt-2 select-none">
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/20 via-red-500/10 to-transparent rounded-full blur-2xl pointer-events-none scale-125 animate-pulse" />
          <Image
            src="/illustrations/throw-away_k2t5.svg"
            alt="Permanently Delete Item"
            width={220}
            height={150}
            className="object-contain relative z-10 drop-shadow-2xl max-h-36 pointer-events-none transform hover:scale-[1.02] transition-transform duration-300"
            priority
          />
        </div>

        {/* Header Text */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-neutral-100 tracking-tight px-2">
            Permanently delete item?
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed max-w-[320px] mx-auto">
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold text-neutral-200">"{itemName}"</span>
            {itemTemplate ? ` (${itemTemplate})` : ""}? This action is <span className="text-red-400 font-semibold">permanent and irreversible</span>.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-2xl border border-neutral-800/90 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-xs transition-all shadow-lg shadow-red-950/60 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
}
