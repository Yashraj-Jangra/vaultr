"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  const [glitchText, setGlitchText] = useState("404");

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.8) {
        const chars = "404!@#$%&*+";
        let glitch = "";
        for (let i = 0; i < 3; i++) {
          if (Math.random() > 0.5) glitch += chars[Math.floor(Math.random() * chars.length)];
          else glitch += "404"[i];
        }
        setGlitchText(glitch);
        setTimeout(() => setGlitchText("404"), 150);
      }
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center relative overflow-hidden p-6">
      {/* ══════════════════════ DECORATIVE BACKGROUND ══════════════════════ */}
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
        {/* Hero Illustration with Glow */}
        <div className="relative flex items-center justify-center mb-6">
          <div
            className="absolute w-44 h-44 rounded-full opacity-20 blur-xl animate-pulse-ring"
            style={{ background: "radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)" }}
          />
          <Image
            src="/illustrations/page-not-found_6wni.svg"
            alt="404 - Not Found"
            width={200}
            height={150}
            className="relative z-10 w-48 h-36 object-contain"
            priority
          />
        </div>

        {/* 404 Glitch Text */}
        <h1
          className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-neutral-100 to-neutral-600 tracking-tighter mb-2 font-mono select-none"
          style={{ textShadow: "0 0 40px rgba(255,255,255,0.05)" }}
        >
          {glitchText}
        </h1>

        <span className="text-[11px] text-neutral-400 uppercase tracking-[0.2em] mb-4 font-semibold border border-neutral-800 bg-neutral-900/60 px-3 py-1 rounded-full">
          Sector Not Found
        </span>

        <p className="text-neutral-400 text-[13px] leading-relaxed mb-8 max-w-xs mx-auto">
          The requested route or encrypted record does not exist on this server. It may have moved or been purged.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-semibold rounded-xl transition-all w-full sm:w-auto active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
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
