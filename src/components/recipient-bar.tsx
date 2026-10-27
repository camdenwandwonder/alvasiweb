"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { setOrderRecipient } from "@/lib/shop/actions";

/** Shown on every page while a manager orders on behalf of an employee. */
export function RecipientBar({ name, roleName }: { name: string; roleName: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = name.split(" ")[0] || name;

  function stop() {
    start(async () => {
      const res = await setOrderRecipient(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Je bestelt weer voor jezelf");
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="mb-5 flex flex-col gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm text-[var(--brand-foreground)] sm:flex-row sm:items-center"
    >
      <UserRound className="hidden h-4 w-4 shrink-0 sm:block" />
      <p className="flex-1">
        <span className="font-semibold">Je bestelt nu namens {name}</span>
        {roleName ? ` (${roleName})` : ""}. De maat, het budget en de maxima van {first} gelden.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/products"
          className="rounded-md px-2.5 py-1 font-medium underline-offset-2 hover:underline"
        >
          Wissel
        </Link>
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--brand-foreground)] px-3 py-1 font-medium text-[var(--brand)] transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Stoppen
        </button>
      </div>
    </div>
  );
}
