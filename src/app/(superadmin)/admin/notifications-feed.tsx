"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/ui";

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
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Order notifications</h2>
        <span
          className={[
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
            live ? "bg-green-100 text-green-700" : "bg-border/60 text-muted",
          ].join(" ")}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              live ? "bg-green-500" : "bg-muted",
            ].join(" ")}
          />
          {live ? "Live" : "Connecting…"}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="New orders from companies will appear here in real time."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{n.title}</p>
                  {n.body ? (
                    <p className="text-sm text-muted">{n.body}</p>
                  ) : null}
                </div>
                <time className="shrink-0 text-xs text-muted">
                  {formatDate(n.created_at)}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
