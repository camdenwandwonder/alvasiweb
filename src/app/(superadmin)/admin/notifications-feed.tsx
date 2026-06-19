"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/primitives";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  type: string;
  created_at: string;
};

export function NotificationsFeed({ initial }: { initial: Notif[] }) {
  const [items, setItems] = useState<Notif[]>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("superadmin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "scope=eq.superadmin",
        },
        (payload) => {
          setItems((prev) => [payload.new as Notif, ...prev].slice(0, 50));
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Activity</h2>
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            live
              ? "bg-green-100 text-green-700"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              live ? "animate-pulse bg-green-500" : "bg-muted-foreground",
            ].join(" ")}
          />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No activity yet"
          description="New orders from companies appear here in real time."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="flex gap-3 rounded-xl border bg-card p-4"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
                <BellRing className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{n.title}</p>
                  <time className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(n.created_at)}
                  </time>
                </div>
                {n.body ? (
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
