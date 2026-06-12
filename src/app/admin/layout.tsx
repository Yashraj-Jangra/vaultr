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
} from "lucide-react";

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

  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
        
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col hidden md:flex">
          <div className="flex h-16 items-center px-6 border-b border-[var(--border)] select-none">
            <Shield className="mr-3 h-5 w-5 text-[var(--accent)]" />
            <h1 className="text-lg font-bold tracking-tight text-[var(--fg)]">
              Vaultr <span className="text-[var(--accent)]">Admin</span>
            </h1>
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
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
             {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
