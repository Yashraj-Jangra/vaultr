"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-neutral-950 border border-red-900/40 rounded-2xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <h3 className="text-base font-semibold text-neutral-100">
              Permanently delete item?
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold text-neutral-200 truncate inline-block max-w-[200px] align-bottom">
                "{itemName}"
              </span>
              {itemTemplate ? ` (${itemTemplate})` : ""}? This action is permanent and cannot be recovered.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-900">
          <Button
            type="button"
            variant="default"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={loading}
            className="text-xs bg-red-600 hover:bg-red-700 text-white border-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Deleting…
              </>
            ) : (
              "Delete Permanently"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
