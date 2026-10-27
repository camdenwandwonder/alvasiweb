"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bookmark, ChevronDown, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteOrderView, saveOrderView } from "@/lib/orders/actions";
import { toSearch, type OrderQuery } from "@/lib/orders/filters";
import type { OverviewData } from "@/lib/orders/overview";
import { Popover } from "./popover";

export function SavedViews({
  data,
  query,
  scopeKey,
  basePath,
}: {
  data: OverviewData;
  query: OrderQuery;
  scopeKey: string;
  basePath: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const current = toSearch({ ...query, pagina: 1 });

  function save(close: () => void) {
    start(async () => {
      const res = await saveOrderView(scopeKey, name.trim(), current);
      if (res.ok) {
        toast.success("Weergave opgeslagen");
        setName("");
        close();
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await deleteOrderView(id);
      if (res.ok) router.refresh();
      else toast.error(res.error ?? "Verwijderen mislukt");
    });
  }

  return (
    <Popover
      align="right"
      className="w-80 p-2"
      trigger={({ toggle }) => (
        <Button variant="outline" onClick={toggle}>
          <Bookmark className="h-4 w-4" /> Weergaven
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      )}
    >
      {(close) => (
        <div className="space-y-2">
          {data.savedViews.length ? (
            <ul>
              {data.savedViews.map((v) => (
                <li key={v.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      router.replace(`${basePath}${v.query}`, { scroll: false });
                    }}
                    className={`min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${
                      v.query === current ? "font-semibold" : ""
                    }`}
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    aria-label={`Weergave ${v.name} verwijderen`}
                    onClick={() => remove(v.id)}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              Bewaar een periode met filters om er later met één klik naar terug te gaan.
            </p>
          )}
          <form
            className="flex gap-1.5 border-t pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save(close);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Naam, bijv. Jassen Q3"
              maxLength={60}
              className="h-9"
            />
            <Button type="submit" size="sm" className="h-9" disabled={!name.trim() || pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Bewaar"}
            </Button>
          </form>
        </div>
      )}
    </Popover>
  );
}

export function ExportMenu({
  data,
  query,
  admin,
}: {
  data: OverviewData;
  query: OrderQuery;
  admin: boolean;
}) {
  const base = toSearch({ ...query, pagina: 1 });
  const href = (soort: string, formaat: string) => {
    const p = new URLSearchParams(base.slice(1));
    p.set("soort", soort);
    p.set("formaat", formaat);
    if (admin) p.set("scope", "admin");
    return `/api/orders/export?${p.toString()}`;
  };
  const kinds = [
    { soort: "bestellingen", label: "Bestellingen", text: "Eén regel per bestelling" },
    { soort: "regels", label: "Bestelregels", text: "Eén regel per product, met maat en prijs" },
    ...(data.scope !== "own"
      ? [{ soort: "medewerkers", label: "Per medewerker", text: "Totalen per medewerker" }]
      : []),
    { soort: "producten", label: "Per product", text: "Aantallen per product en maat" },
  ];

  return (
    <Popover
      align="right"
      className="w-80 p-2"
      trigger={({ toggle }) => (
        <Button variant="outline" onClick={toggle}>
          <Download className="h-4 w-4" /> Exporteren
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      )}
    >
      <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
        Exporteert precies de huidige selectie: {data.range.label.toLowerCase()}
        {data.summary.orders ? `, ${data.summary.orders} bestellingen` : ""}.
      </p>
      <ul className="space-y-0.5">
        {kinds.map((k) => (
          <li key={k.soort} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{k.label}</span>
              <span className="block text-xs text-muted-foreground">{k.text}</span>
            </span>
            <a href={href(k.soort, "xlsx")} className="rounded-md border bg-background px-2 py-1 text-xs font-medium hover:bg-muted">
              Excel
            </a>
            <a href={href(k.soort, "csv")} className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted">
              CSV
            </a>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
