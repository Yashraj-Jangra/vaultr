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
} from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { name: "Analytics",     href: "/admin/analytics",       icon: BarChart3   },
  { name: "Database",      href: "/admin/database",        icon: DatabaseIcon},
  { name: "Support",       href: "/admin/support",         icon: LifeBuoy    },
  { name: "Themes",        href: "/admin/theme",           icon: Palette     },
  { name: "Users",         href: "/admin/users",           icon: Users       },
  { name: "System Ops",    href: "/admin/system",          icon: ServerCog   },
  { name: "Security Logs", href: "/admin/logs",            icon: ScrollText  },
  { name: "Send Email",    href: "/admin/email",           icon: Mail        },
  { name: "Templates",     href: "/admin/email/templates", icon: FileText    },
  { name: "Content",       href: "/admin/content",         icon: FileText    },
  { name: "SMTP Settings", href: "/admin/smtp",            icon: Settings    },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <div className="flex h-16 items-center justify-between px-6 border-b border-[var(--border)] select-none">
            <div className="flex items-center">
              <Shield className="mr-3 h-5 w-5 text-[var(--accent)]" />
              <h1 className="text-lg font-bold tracking-tight text-[var(--fg)]">
                Vaultr <span className="text-[var(--accent)]">Admin</span>
              </h1>
            </div>
            {mobileMenuOpen && (
              <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1 text-[var(--fg-muted)] hover:text-[var(--fg)]">
                <X className="h-5 w-5" />
              </button>
            )}
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
