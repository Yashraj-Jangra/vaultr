"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart3, 
  Palette, 
  Users, 
  Mail, 
  FileText, 
  Settings,
  Shield,
  ArrowLeft,
  ScrollText,
  Database as DatabaseIcon,
  LifeBuoy,
  ServerCog,
  Menu,
  X,
  CreditCard,
  Activity,
  HardDrive
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/context/ThemeContext";

const NAV_ITEMS = [
  { name: "Analytics",     href: "/admin/analytics",       icon: BarChart3   },
  { name: "Database",      href: "/admin/database",        icon: DatabaseIcon},
  { name: "Storage",       href: "/admin/storage",         icon: HardDrive   },
  { name: "Support",       href: "/admin/support",         icon: LifeBuoy    },
  { name: "Themes",        href: "/admin/theme",           icon: Palette     },
  { name: "Users",         href: "/admin/users",           icon: Users       },
  { name: "Sessions",      href: "/admin/sessions",        icon: Activity    },
  { name: "System Ops",    href: "/admin/system",          icon: ServerCog   },
  { name: "Security Logs", href: "/admin/logs",            icon: ScrollText  },
  { name: "Send Email",    href: "/admin/email",           icon: Mail        },
  { name: "Templates",     href: "/admin/email/templates", icon: FileText    },
  { name: "Content",       href: "/admin/content",         icon: FileText    },
  { name: "SMTP Settings", href: "/admin/smtp",            icon: Settings    },
  { name: "Card Settings", href: "/admin/cards",           icon: CreditCard  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { activeTheme } = useTheme();

  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)] relative">
        
        {/* Mobile backdrop */}
        <div 
          className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-opacity duration-300 ease-in-out ${
            mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`} 
          onClick={() => setMobileMenuOpen(false)}
        />

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex flex-col p-4 border border-[var(--border)] bg-neutral-950/80 rounded-2xl mx-3 my-4 select-none gap-3 relative overflow-hidden group">
            {/* Tech Corner Crosshairs */}
            <div className="absolute top-1.5 left-1.5 text-[8px] font-mono text-[var(--accent)]/45 leading-none pointer-events-none select-none">+</div>
            <div className="absolute top-1.5 right-1.5 text-[8px] font-mono text-[var(--accent)]/45 leading-none pointer-events-none select-none">+</div>
            <div className="absolute bottom-1.5 left-1.5 text-[8px] font-mono text-[var(--accent)]/45 leading-none pointer-events-none select-none">+</div>
            <div className="absolute bottom-1.5 right-1.5 text-[8px] font-mono text-[var(--accent)]/45 leading-none pointer-events-none select-none">+</div>

            {/* High-Fidelity Animated Abstract Cyber/Crypto Mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08] select-none">
              {/* Technical Blueprint Grid */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--fg)_1px,transparent_1px),linear-gradient(to_bottom,var(--fg)_1px,transparent_1px)] bg-[size:10px_10px] opacity-[0.15]" />
              
              <svg 
                className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%]" 
                viewBox="0 0 400 200" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                style={{ animation: "adminTechFloat 18s infinite ease-in-out" }}
              >
                <style>{`
                  @keyframes adminTechFloat {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-6px) rotate(0.5deg); }
                  }
                  @keyframes adminTechDash {
                    to { stroke-dashoffset: -120; }
                  }
                  @keyframes adminPolyPulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                  }
                `}</style>
                <defs>
                  <linearGradient id="adminPolyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="adminPolyGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id="adminNodeGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Polygonal Faces */}
                <g style={{ animation: "adminPolyPulse 6s infinite ease-in-out" }}>
                  <polygon points="40,30 140,20 90,80" fill="url(#adminPolyGrad1)" stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.3" />
                  <polygon points="140,20 240,40 180,100" fill="url(#adminPolyGrad2)" stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.2" />
                  <polygon points="90,80 180,100 70,150" fill="url(#adminPolyGrad1)" stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.2" />
                  <polygon points="180,100 240,40 300,110" fill="url(#adminPolyGrad1)" stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.3" />
                  <polygon points="300,110 360,60 330,140" fill="url(#adminPolyGrad2)" stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.2" />
                </g>

                {/* Linking Connections */}
                <g stroke="var(--fg)" strokeWidth="0.5" strokeOpacity="0.2">
                  <line x1="40" y1="30" x2="20" y2="90" />
                  <line x1="90" y1="80" x2="20" y2="90" />
                  <line x1="70" y1="150" x2="140" y2="170" />
                  <line x1="180" y1="100" x2="140" y2="170" />
                  <line x1="300" y1="110" x2="270" y2="180" />
                  <line x1="330" y1="140" x2="270" y2="180" />
                  <line x1="240" y1="40" x2="310" y2="20" />
                  <line x1="360" y1="60" x2="310" y2="20" />
                </g>

                {/* Pulsing Data Path Flows */}
                <path 
                  d="M40,30 L140,20 L240,40 L300,110 L330,140" 
                  stroke="var(--accent)" 
                  strokeWidth="0.75" 
                  strokeDasharray="4 8" 
                  style={{ animation: "adminTechDash 5s linear infinite" }} 
                />
                <path 
                  d="M90,80 L180,100 L300,110 L360,60" 
                  stroke="var(--accent)" 
                  strokeWidth="0.75" 
                  strokeDasharray="3 6" 
                  style={{ animation: "adminTechDash 7s linear infinite reverse" }} 
                />

                {/* Monospace Node Data Annotations */}
                <g fill="var(--fg)" opacity="0.4" fontSize="7" fontFamily="monospace">
                  <text x="45" y="28">[0x4B]</text>
                  <text x="145" y="18">[0xDF]</text>
                  <text x="95" y="78">[0x22]</text>
                  <text x="185" y="98">[0x9E]</text>
                  <text x="305" y="108">[0x10]</text>
                  <text x="335" y="138">[0x7A]</text>
                </g>

                {/* Central Key Intersection Hubs */}
                <g>
                  {/* Data Hub 1 */}
                  <circle cx="180" cy="100" r="12" fill="url(#adminNodeGlow)" />
                  <circle cx="180" cy="100" r="2" fill="var(--accent)" />
                  <circle cx="180" cy="100" r="5" stroke="var(--accent)" strokeWidth="0.5" strokeOpacity="0.5" className="animate-ping" style={{ animationDuration: "3s" }} />

                  {/* Data Hub 2 */}
                  <circle cx="300" cy="110" r="14" fill="url(#adminNodeGlow)" />
                  <circle cx="300" cy="110" r="2" fill="var(--accent)" />
                  <circle cx="300" cy="110" r="6" stroke="var(--accent)" strokeWidth="0.5" strokeOpacity="0.4" className="animate-ping" style={{ animationDuration: "4.5s" }} />
                </g>
              </svg>
            </div>

            {/* Title Block & Exit Trigger */}
            <div className="flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeTheme.mode === "dark" ? "/brand/vaultr-vr-dark-transparent.svg" : "/brand/vaultr-vr-light-transparent.svg"}
                  alt="Vaultr Mark"
                  className="w-5 h-5 object-contain shrink-0 filter drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.25)]"
                />
                <div className="flex flex-col">
                  <h1 className="text-[12px] font-bold tracking-widest uppercase text-[var(--fg)] flex items-center gap-1.5 leading-none">
                    _vaultr <span className="text-[8px] tracking-normal font-mono border border-[var(--accent)]/30 text-[var(--accent)] px-1.5 py-0.5 rounded leading-none">root</span>
                  </h1>
                </div>
              </div>
              {mobileMenuOpen ? (
                <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]">
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <Link
                  href="/vault"
                  title="Exit admin panel"
                  className="p-1 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/35 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            {/* Sub-Branding Tag: Secured by lock emblem */}
            <div className="flex items-center gap-2 z-10 bg-neutral-950/45 border border-neutral-900/50 rounded-lg p-2">
              <div className="relative flex items-center justify-center shrink-0 w-6 h-6 rounded bg-[var(--accent)]/5 border border-[var(--accent)]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeTheme.mode === "dark" ? "/brand/vaultr-lock-dark-transparent.svg" : "/brand/vaultr-lock-light-transparent.svg"}
                  alt="Lock Icon"
                  className="w-4 h-4 object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-neutral-400 font-semibold tracking-wide uppercase leading-none">Secured System</p>
                <p className="text-[8px] text-neutral-500 font-mono truncate leading-none mt-1">AES-256 / Zero-Knowledge</p>
              </div>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              // Exact match for shorter paths that are prefixes of other paths
              const isActive = item.href === "/admin/email"
                ? pathname === "/admin/email"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--bg)]"
                      : "text-[var(--fg-muted)] hover:bg-[var(--border)] hover:text-[var(--fg)]"
                  }`}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="border-t border-[var(--border)] p-4">
            <Link
              href="/vault"
              className="flex items-center justify-center w-full rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--fg-muted)] hover:bg-[var(--border)] hover:text-[var(--fg)] transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Vault
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto flex flex-col">
          {/* Mobile Header */}
          <div className="md:hidden h-14 border-b border-[var(--border)] bg-[var(--surface)] flex items-center px-4 shrink-0 sticky top-0 z-30">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="ml-2 font-semibold text-[var(--fg)]">Admin Panel</h1>
          </div>
          <div className="flex-1 h-full">
             {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
