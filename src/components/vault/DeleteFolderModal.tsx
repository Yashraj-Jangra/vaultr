"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, X } from "lucide-react";

interface DeleteFolderModalProps {
  open: boolean;
  folderName: string;
  itemCount: number;
  onClose: () => void;
  onConfirm: (disposition: "uncategorize" | "trash") => Promise<void> | void;
}

export function DeleteFolderModal({
  open,
  folderName,
  itemCount,
  onClose,
  onConfirm,
}: DeleteFolderModalProps) {
  const [loadingDisp, setLoadingDisp] = useState<"uncategorize" | "trash" | null>(null);

  useEffect(() => {
    if (open) setLoadingDisp(null);
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loadingDisp) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loadingDisp, onClose]);

  if (!open) return null;

  const handleConfirm = async (disposition: "uncategorize" | "trash") => {
    setLoadingDisp(disposition);
    try {
      await onConfirm(disposition);
    } finally {
      setLoadingDisp(null);
      onClose();
    }
  };

  const displayName = folderName.split("/").pop() || folderName;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-neutral-950 border border-neutral-800/80 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-center relative overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Top right close button */}
        <button
          onClick={onClose}
          disabled={!!loadingDisp}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Illustration */}
        <div className="relative w-36 h-28 mx-auto flex items-center justify-center pt-2">
          <div className="absolute inset-0 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
          <Image
            src="/illustrations/throw-away_k2t5.svg"
            alt="Delete folder"
            width={140}
            height={110}
            className="object-contain relative z-10 drop-shadow-md"
          />
        </div>

        {/* Header Text */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-100 truncate px-2">
            Delete "{displayName}"?
          </h3>
          <p className="text-[13px] text-neutral-400 leading-relaxed max-w-[280px] mx-auto">
            This folder contains <span className="text-neutral-200 font-semibold">{itemCount} item{itemCount === 1 ? "" : "s"}</span>.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => handleConfirm("uncategorize")}
            disabled={!!loadingDisp}
            className="w-full py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-white text-neutral-900 font-semibold text-[13px] transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {loadingDisp === "uncategorize" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting folder…
              </>
            ) : (
              "Delete Folder (Keep Items)"
            )}
          </button>
        </div>

        {/* Secondary Destructive Link */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => handleConfirm("trash")}
            disabled={!!loadingDisp}
            className="group inline-flex items-center gap-1.5 text-[12px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" />
            {loadingDisp === "trash" ? (
              <span><Loader2 className="w-3 h-3 animate-spin inline mr-1" />Trashing items…</span>
            ) : (
              <span>Delete folder and move {itemCount} item{itemCount === 1 ? "" : "s"} to Trash</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
