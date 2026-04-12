import React, { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, Info } from "lucide-react";

interface PasswordHealthProps {
  password?: string;
}

export function PasswordHealth({ password }: PasswordHealthProps) {
  const [pwnCount, setPwnCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0); // 0-4

  useEffect(() => {
    if (!password) {
      setPwnCount(null);
      setScore(0);
      return;
    }

    let isMounted = true;
    const analyze = async () => {
      setLoading(true);

      // 1. Calculate basic score
      let s = 0;
      if (password.length >= 8) s += 1;
      if (password.length >= 12) s += 1;
      if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
      if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) s += 1;
      if (isMounted) setScore(s);

      // 2. K-Anonymity API call (Pwned Passwords)
      try {
        const buffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
        
        const prefix = hashHex.slice(0, 5);
        const suffix = hashHex.slice(5);

        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
        if (!res.ok) throw new Error("API failed");
        
        const text = await res.text();
        const lines = text.split("\n");
        let found = 0;
        
        for (const line of lines) {
          const [hashSuffix, countStr] = line.split(":");
          if (hashSuffix === suffix) {
            found = parseInt(countStr.trim(), 10);
            break;
          }
        }

        if (isMounted) setPwnCount(found);
      } catch (err) {
        console.error("Pwned password check failed", err);
        if (isMounted) setPwnCount(null); // Silent fail, preserve score
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Debounce analysis
    const timer = setTimeout(analyze, 500);
    return () => { isMounted = false; clearTimeout(timer); };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-3 pt-3 border-t border-[var(--border)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-neutral-600 uppercase tracking-wider">Health Analysis</span>
        <span className="text-[11px] font-mono text-neutral-400">
          {score < 2 ? "Weak" : score < 4 ? "Good" : "Strong"}
        </span>
      </div>

      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4].map((v) => (
          <div
            key={v}
            className={`flex-1 rounded-full ${
              score >= v
                ? score < 2 ? "bg-red-500" : score < 4 ? "bg-amber-400" : "bg-green-500"
                : "bg-neutral-800"
            }`}
          />
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <div className="w-3 h-3 border-2 border-neutral-600 border-t-neutral-400 rounded-full animate-spin shrink-0" />
          Checking known data breaches using k-Anonymity...
        </div>
      ) : pwnCount !== null ? (
        pwnCount > 0 ? (
          <div className="flex items-center gap-2 text-[11px] p-2 rounded-md bg-red-950/20 text-red-400 border border-red-900/40">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed">
              This password has appeared in <strong>{pwnCount.toLocaleString()}</strong> known data breaches. 
              <strong> You should change it immediately.</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] p-2 rounded-md bg-emerald-950/20 text-emerald-400 border border-emerald-900/40">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>This password has not been found in any known breaches.</span>
          </div>
        )
      ) : (
        <div className="flex items-center gap-2 text-[11px] text-neutral-600">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Could not complete breach check at this time.</span>
        </div>
      )}
    </div>
  );
}
