"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Home, FileQuestion } from "lucide-react";

export default function NotFound() {
  const [glitchText, setGlitchText] = useState("404");

  useEffect(() => {
    // A nice glitch effect "wow factor" for the 404 screen
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
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] flex items-center justify-center relative overflow-hidden">
      {/* ══════════════════════ DECORATIVE BACKGROUND ══════════════════════ */}
      
      {/* Grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.015) 0%, transparent 70%)" }} />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg px-5 border border-[var(--border)] p-12 bg-neutral-950/40 backdrop-blur-md shadow-2xl rounded-3xl">
        
        {/* Animated Icon Halo */}
        <div className="relative flex items-center justify-center mb-8 group">
          <div
            className="absolute w-32 h-32 rounded-full opacity-20 group-hover:opacity-40 transition-opacity duration-1000 animate-pulse-ring"
            style={{ background: "radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)" }}
          />
          <div className="w-20 h-20 rounded-3xl border flex items-center justify-center transition-all duration-500 bg-[#0d0d0d] border-red-900/30 relative z-10 shadow-[0_0_40px_rgba(220,38,38,0.05)] group-hover:border-red-900/60 group-hover:shadow-[0_0_60px_rgba(220,38,38,0.1)]">
            <FileQuestion className="w-8 h-8 text-neutral-600 group-hover:text-red-400 transition-colors duration-500" />
          </div>
        </div>

        {/* Glitch 404 Text */}
        <h1 className="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-neutral-200 to-neutral-700 tracking-tighter mb-2 font-mono select-none" style={{ textShadow: "0 0 40px rgba(255,255,255,0.05)"}}>
          {glitchText}
        </h1>

        <p className="text-[11px] text-neutral-500 uppercase tracking-[0.2em] mb-6 font-semibold border border-[var(--border)] bg-[#0d0d0d] px-3 py-1 rounded-full">
          Sector Not Found
        </p>

        <p className="text-neutral-500 text-[14px] leading-relaxed mb-10 max-w-sm mx-auto">
          The encrypted blob or route you are searching for does not mathematically exist on this server. It may have been permanently deleted.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <button onClick={() => window.history.back()} className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-100 hover:bg-white text-neutral-900 text-[13px] font-medium rounded-xl transition-all w-full sm:w-auto active:scale-[0.98]">
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <Link href="/" className="flex items-center justify-center gap-2 px-6 py-3 border border-[var(--border)] text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900/50 text-[13px] rounded-xl transition-all w-full sm:w-auto active:scale-[0.98]">
            <Home className="w-4 h-4" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
