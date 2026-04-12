"use client";

import { FileText } from "lucide-react";

export default function ContentAdminPage() {
  return (
    <div className="p-8 pb-20 max-w-4xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Content Management</h2>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Manage static text, legal docs, and onboarding tooltips.</p>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 bg-[var(--bg)] rounded-full flex items-center justify-center mb-4 border border-[var(--border)]">
          <FileText className="h-8 w-8 text-[var(--fg-muted)]" />
        </div>
        <h3 className="text-lg font-medium text-[var(--fg)]">Module Under Construction</h3>
        <p className="text-sm text-[var(--fg-muted)] mt-2 max-w-md">
          The content management system (CMS) for dynamic injects is planned for a future sprint. 
          Use the codebase directly to update static copy in the meantime.
        </p>
      </div>
    </div>
  );
}
