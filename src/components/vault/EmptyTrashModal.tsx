"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, Trash2, X } from "lucide-react";

export interface PurgeTarget {
  type: "all" | "selected" | "single";
  count: number;
  ids: string[];
}

interface EmptyTrashModalProps {
  open: boolean;
  target: PurgeTarget | null;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

export function EmptyTrashModal({
  open,
  target,
  onClose,
  onConfirm,
}: EmptyTrashModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setShowPassword(false);
      setError("");
      setBusy(false);
    }
  }, [open, target]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, busy, onClose]);

  if (!open || !target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");

    if (!password) {
      setError("Master password is required.");
      return;
    }

    setBusy(true);
    try {
      await onConfirm(password);
      setPassword("");
      setError("");
      onClose();
    } catch (err) {
      console.error("[Empty Trash Error]", err);
      setError("Incorrect Master Password. Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const isAll = target.type === "all";
  const count = target.count;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="w-full max-w-[460px] bg-neutral-950/95 border border-neutral-800/90 rounded-3xl p-8 sm:p-9 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 text-center relative overflow-hidden backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Right Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900/80 transition-colors cursor-pointer disabled:opacity-50 z-20"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Large Hero SVG Illustration with Ambient Glow */}
        <div className="relative w-64 h-44 mx-auto flex items-center justify-center pt-2 select-none">
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/20 via-red-500/10 to-transparent rounded-full blur-2xl pointer-events-none scale-125 animate-pulse" />
          <Image
            src="/illustrations/throw-away_k2t5.svg"
            alt="Empty Trash Confirmation"
            width={250}
            height={180}
            className="object-contain relative z-10 drop-shadow-2xl max-h-44 pointer-events-none transform hover:scale-[1.02] transition-transform duration-300"
            priority
          />
        </div>

        {/* Header Text */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-neutral-100 tracking-tight px-2">
            {isAll ? "Empty Entire Trash?" : `Permanently Delete ${count} Item${count > 1 ? "s" : ""}?`}
          </h3>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-[340px] mx-auto">
            This action is <span className="text-red-400 font-semibold">permanent and irreversible</span>.{" "}
            {isAll ? (
              <>All items in Trash will be purged forever from your vault.</>
            ) : (
              <>Selected <span className="text-neutral-200 font-medium">{count} item{count === 1 ? "" : "s"}</span> will be purged forever.</>
            )}
          </p>
        </div>

        {/* Reprompt Master Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1 text-left">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 px-0.5">
              <Lock className="w-3.5 h-3.5 text-neutral-500" />
              <span>Confirm Master Password</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your master password"
                autoFocus
                disabled={busy}
                className={`w-full bg-neutral-900/90 border ${
                  error
                    ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/40"
                    : "border-neutral-800 focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700/50"
                } rounded-2xl px-4 py-3 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-all pr-11 shadow-inner`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={busy}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-xs text-red-400 font-medium animate-in fade-in duration-150 mt-1">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 py-3 px-5 rounded-2xl border border-neutral-800/90 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-sm transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className="flex-1 py-3 px-5 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-sm transition-all shadow-lg shadow-red-950/60 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>{isAll ? "Empty Trash" : `Delete ${count} Item${count > 1 ? "s" : ""}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
