"use client";

import React from "react";
import Image from "next/image";
import { AlertCircle, RotateCcw } from "lucide-react";

export type ErrorType =
  | "network"
  | "auth"
  | "security"
  | "not-found"
  | "server"
  | "upload"
  | "generic";

interface ErrorDisplayProps {
  type?: ErrorType;
  title?: string;
  message?: string;
  onRetry?: () => void;
  actionText?: string;
  className?: string;
}

const ERROR_CONFIGS: Record<ErrorType, { illustration: string; defaultTitle: string; glow: string }> = {
  network: {
    illustration: "/illustrations/connection-lost_am29.svg",
    defaultTitle: "Connection Problem",
    glow: "rgba(59, 130, 246, 0.15)",
  },
  auth: {
    illustration: "/illustrations/goodbye_mkv7.svg",
    defaultTitle: "Authentication Required",
    glow: "rgba(245, 158, 11, 0.15)",
  },
  security: {
    illustration: "/illustrations/firewall_cfej.svg",
    defaultTitle: "Access Restricted",
    glow: "rgba(239, 68, 68, 0.15)",
  },
  "not-found": {
    illustration: "/illustrations/lost_teip.svg",
    defaultTitle: "Item Not Found",
    glow: "rgba(168, 85, 247, 0.15)",
  },
  server: {
    illustration: "/illustrations/server-failure_syqp.svg",
    defaultTitle: "Server Error",
    glow: "rgba(239, 68, 68, 0.15)",
  },
  upload: {
    illustration: "/illustrations/upload-warning_aqma.svg",
    defaultTitle: "Upload Issue",
    glow: "rgba(245, 158, 11, 0.15)",
  },
  generic: {
    illustration: "/illustrations/buggy-code_qtah.svg",
    defaultTitle: "Something Went Wrong",
    glow: "rgba(245, 158, 11, 0.15)",
  },
};

export function ErrorDisplay({
  type = "generic",
  title,
  message,
  onRetry,
  actionText = "Try again",
  className = "",
}: ErrorDisplayProps) {
  const config = ERROR_CONFIGS[type] || ERROR_CONFIGS.generic;

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 ${className}`}>
      <div className="relative flex items-center justify-center mb-5">
        <div
          className="absolute w-32 h-32 rounded-full opacity-30 blur-lg"
          style={{ background: config.glow }}
        />
        <Image
          src={config.illustration}
          alt=""
          width={150}
          height={110}
          className="relative z-10 w-36 h-28 object-contain"
        />
      </div>

      <h3 className="text-base font-semibold text-neutral-100 mb-1.5">
        {title || config.defaultTitle}
      </h3>

      {message && (
        <p className="text-xs text-neutral-400 max-w-sm mx-auto mb-6 leading-relaxed">
          {message}
        </p>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-900 text-xs font-semibold rounded-xl transition-all active:scale-[0.98]"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {actionText}
        </button>
      )}
    </div>
  );
}
