"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSettingsHistory, type SettingsHistoryEntry } from "@/lib/settings/actions";

export function SettingsHistory({
  companyId,
  initial,
  more: initialMore,
}: {
  companyId: string;
  initial: SettingsHistoryEntry[];
  more: boolean;
}) {
  const [entries, setEntries] = useState(initial);
  const [more, setMore] = useState(initialMore);
  const [pending, start] = useTransition();

  if (!entries.length)
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed py-12 text-center">
        <History className="mb-2 h-6 w-6 text-muted-foreground" />
        <p className="font-medium">Nog geen wijzigingen</p>
        <p className="mt-1 text-sm text-muted-foreground">Hier zie je wie de instellingen of adressen aanpaste, en wanneer.</p>
      </div>
    );

  return (
    <div>
      <ol className="divide-y rounded-xl border bg-card">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-baseline sm:gap-4">
            <span className="w-44 shrink-0 text-xs text-muted-foreground tabular-nums">
              {new Date(e.created_at).toLocaleString("nl-NL", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Europe/Amsterdam",
              })}
            </span>
            <span className="min-w-0 flex-1">{e.summary}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{e.actor_name ?? "Onbekend"}</span>
          </li>
        ))}
      </ol>
      {more ? (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await loadSettingsHistory(companyId, entries.length);
                if (res.ok) {
                  setEntries((list) => [...list, ...res.entries]);
                  setMore(res.more);
                }
              })
            }
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Meer laden
          </Button>
        </div>
      ) : null}
    </div>
  );
}
