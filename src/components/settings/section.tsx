"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** One settings block: what it is on the left, the fields in a card on the right. */
export function SettingsBlock({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-4 border-b pb-8 last:border-b-0 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8", className)}>
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      <div className="min-w-0 rounded-xl border bg-card p-5">{children}</div>
    </section>
  );
}

/** Warns before leaving the page while a form has unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}

/** Small "Niet opgeslagen" marker next to a save button. */
export function UnsavedHint({ dirty }: { dirty: boolean }) {
  return dirty ? <span className="text-sm text-amber-700">Wijzigingen nog niet opgeslagen</span> : null;
}
