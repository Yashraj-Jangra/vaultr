"use client";

import React, { useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { RotateCw, Home, ShieldAlert } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

interface ErrorConfig {
  illustration: string;
  badge: string;
  title: string;
  description: string;
  glowColor: string;
}

function resolveErrorConfig(error: Error): ErrorConfig {
  const msg = (error?.message || "").toLowerCase();
  const name = (error?.name || "").toLowerCase();

  // 1. Connection / Network Loss
  if (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("offline") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout") ||
    msg.includes("internet")
  ) {
    return {
      illustration: "/illustrations/connection-lost_am29.svg",
      badge: "Connection Lost",
      title: "Unable to connect to server",
      description: "Vaultr lost connection to the backend server. Check your network or local API status.",
      glowColor: "rgba(59, 130, 246, 0.25)",
    };
  }

  // 2. Security / Firewall / Forbidden
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("denied") || msg.includes("csrf")) {
    return {
      illustration: "/illustrations/firewall_cfej.svg",
      badge: "Access Denied",
      title: "Security perimeter restricted",
      description: "You do not have authorization to view this resource or your security token has expired.",
      glowColor: "rgba(239, 68, 68, 0.25)",
    };
  }

  // 3. Unauthorized / Session Expired
  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("session")) {
    return {
      illustration: "/illustrations/goodbye_mkv7.svg",
      badge: "Session Expired",
      title: "Authentication needed",
      description: "Your session token expired. Please re-authenticate to safely continue using your vault.",
      glowColor: "rgba(245, 158, 11, 0.25)",
    };
  }

  // 4. Missing Data / Corrupt Object
  if (msg.includes("not found") || msg.includes("404") || msg.includes("null") || msg.includes("missing")) {
    return {
      illustration: "/illustrations/lost_teip.svg",
      badge: "Resource Missing",
      title: "Encrypted record unavailable",
      description: "The requested record could not be reconstructed from the encrypted store.",
      glowColor: "rgba(168, 85, 247, 0.25)",
    };
  }

  // 5. Server Failure / Internal 500
  if (msg.includes("500") || msg.includes("server") || msg.includes("database") || msg.includes("sql")) {
    return {
      illustration: "/illustrations/server-failure_syqp.svg",
      badge: "Server Anomaly",
      title: "Internal server error",
      description: "The secure vault service encountered an unexpected error processing this transaction.",
      glowColor: "rgba(239, 68, 68, 0.25)",
    };
  }

  // 6. Generic Runtime Crash
  return {
    illustration: "/illustrations/buggy-code_qtah.svg",
    badge: "Runtime Exception",
    title: "Something went wrong",
    description: error?.message || "An unexpected error occurred while rendering this view.",
    glowColor: "rgba(245, 158, 11, 0.25)",
  };
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  const config = useMemo(() => resolveErrorConfig(error), [error]);

  useEffect(() => {
    console.error("[Vaultr ErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center relative overflow-hidden p-6">
      {/* Decorative Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md px-6 py-10 border border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md shadow-2xl rounded-3xl">
        {/* Dynamic Hero Illustration */}
        <div className="relative flex items-center justify-center mb-6">
          <div
            className="absolute w-44 h-44 rounded-full opacity-25 blur-xl animate-pulse-ring"
            style={{ background: config.glowColor }}
          />
          <Image
            src={config.illustration}
            alt={config.title}
            width={200}
            height={150}
            className="relative z-10 w-48 h-36 object-contain"
            priority
          />
        </div>

        <span className="text-[11px] text-neutral-300 uppercase tracking-[0.2em] mb-3 font-semibold border border-neutral-800 bg-neutral-900/80 px-3 py-1 rounded-full flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
          {config.badge}
        </span>

        <h1 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight mb-2">
          {config.title}
        </h1>

        <p className="text-neutral-400 text-[13px] leading-relaxed mb-8 max-w-xs mx-auto">
          {config.description}
        </p>

        {error?.digest && (
          <div className="mb-6 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] font-mono text-neutral-500">
            Digest: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-semibold rounded-xl transition-all w-full sm:w-auto active:scale-[0.98]"
          >
            <RotateCw className="w-4 h-4" /> Try again
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-5 py-2.5 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 hover:bg-neutral-900 text-[13px] rounded-xl transition-all w-full sm:w-auto active:scale-[0.98]"
          >
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
