"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Search, UserRound } from "lucide-react";
import { Popover } from "@/components/orders/popover";
import { cn } from "@/lib/utils";
import { setOrderRecipient } from "@/lib/shop/actions";

export type RecipientOption = { id: string; name: string; role: string | null };

/** "Bestellen voor": managers order with someone else's size, budget and maxima. */
export function RecipientSwitch({
  people,
  current,
}: {
  people: RecipientOption[];
  current: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [pending, start] = useTransition();
  const t = term.trim().toLowerCase();
  const shown = t
    ? people.filter((p) => `${p.name} ${p.role ?? ""}`.toLowerCase().includes(t))
    : people;

  function pick(id: string | null, close: () => void) {
    close();
    start(async () => {
      const res = await setOrderRecipient(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.name ? `Je bestelt nu namens ${res.name}` : "Je bestelt weer voor jezelf");
      router.replace("/products", { scroll: false });
      router.refresh();
    });
  }

  return (
    <Popover
      align="right"
      className="w-80"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm transition hover:bg-muted",
            current && "border-[var(--brand)] bg-[var(--brand)]/10 font-medium",
          )}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
          <span className="text-muted-foreground">Bestellen voor:</span>
          <span className="max-w-36 truncate">{current?.name ?? "mezelf"}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
            Bestel met de maat, het budget en de maxima van een medewerker. De bestelling komt op
            diens naam, met jou als plaatser.
          </p>
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Zoek een medewerker"
              className="h-9 w-full rounded-lg border bg-transparent pr-2 pl-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => pick(null, close)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {!current ? <Check className="h-4 w-4" /> : null}
                </span>
                Mezelf
              </button>
            </li>
            {shown.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id, close)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="flex h-4 w-4 items-center justify-center">
                    {current?.id === p.id ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.role ? <span className="text-xs text-muted-foreground">{p.role}</span> : null}
                </button>
              </li>
            ))}
            {!shown.length ? (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Niemand gevonden</li>
            ) : null}
          </ul>
        </div>
      )}
    </Popover>
  );
}
