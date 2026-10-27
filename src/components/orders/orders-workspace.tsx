"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ClipboardList, Package, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toSearch, type OrderQuery, type OrderView } from "@/lib/orders/filters";
import type { OverviewData } from "@/lib/orders/overview";
import { OrderFilters, type Go } from "./order-filters";
import { OrderSummary } from "./order-summary";
import { OrdersTable } from "./orders-table";
import { PeopleView } from "./people-view";
import { ProductsView } from "./products-view";
import { OrderDrawer } from "./order-drawer";
import { ExportMenu, SavedViews } from "./toolbar";

export function OrdersWorkspace({
  data,
  query,
  basePath,
  detailBase,
  title,
  description,
  canApprove,
  scopeKey,
  initialOrderId,
}: {
  data: OverviewData;
  query: OrderQuery;
  basePath: string;
  /** Prefix of the full order page; the id is appended. */
  detailBase: string;
  title: string;
  description: string;
  canApprove: boolean;
  scopeKey: string;
  initialOrderId: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(initialOrderId);
  const own = data.scope === "own";

  const go: Go = useCallback(
    (patch) => {
      const next: OrderQuery = { ...query, ...patch, pagina: "pagina" in patch ? patch.pagina! : 1 };
      start(() => router.replace(`${basePath}${toSearch(next, { bestelling: openId })}`, { scroll: false }));
    },
    [query, basePath, router, openId],
  );

  const open = useCallback((id: string | null) => {
    setOpenId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("bestelling", id);
    else url.searchParams.delete("bestelling");
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const index = openId ? data.rows.findIndex((r) => r.id === openId) : -1;
  const views: { key: OrderView; label: string; icon: typeof Users }[] = [
    { key: "bestellingen", label: "Bestellingen", icon: ClipboardList },
    ...(own ? [] : [{ key: "medewerkers" as const, label: "Per medewerker", icon: Users }]),
    { key: "producten", label: "Per product", icon: Package },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex gap-2">
          <SavedViews data={data} query={query} scopeKey={scopeKey} basePath={basePath} />
          <ExportMenu data={data} query={query} admin={data.scope === "admin"} />
        </div>
      </div>

      <OrderFilters data={data} query={query} go={go} pending={pending} />

      <div className={cn("space-y-5 transition-opacity", pending && "pointer-events-none opacity-60")}>
        {data.summary.pendingOutside > 0 && !query.status.includes("pending_approval") ? (
          <button
            type="button"
            onClick={() => go({ periode: "alles", status: ["pending_approval"], weergave: "bestellingen" })}
            className="flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-900 hover:bg-amber-100"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {data.summary.pendingOutside === 1
              ? "1 bestelling die op goedkeuring wacht valt buiten deze periode."
              : `${data.summary.pendingOutside} bestellingen die op goedkeuring wachten vallen buiten deze periode.`}
            <span className="ml-auto font-medium">Toon ze</span>
          </button>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {data.range.label}
          </p>
          <OrderSummary data={data} go={go} />
        </div>

        <div className="flex gap-1 border-b" role="tablist">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={query.weergave === v.key}
              onClick={() => go({ weergave: v.key })}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[15px] font-medium transition",
                query.weergave === v.key
                  ? "border-[var(--brand)] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
            </button>
          ))}
        </div>

        {query.weergave === "medewerkers" && !own ? (
          <PeopleView data={data} query={query} go={go} />
        ) : query.weergave === "producten" ? (
          <ProductsView data={data} go={go} />
        ) : (
          <OrdersTable
            data={data}
            query={query}
            go={go}
            canApprove={canApprove}
            openId={openId}
            onOpen={open}
          />
        )}
      </div>

      {openId ? (
        <OrderDrawer
          orderId={openId}
          version={data}
          detailHref={`${detailBase}${openId}`}
          onClose={() => open(null)}
          onPrev={index > 0 ? () => open(data.rows[index - 1]!.id) : undefined}
          onNext={index >= 0 && index < data.rows.length - 1 ? () => open(data.rows[index + 1]!.id) : undefined}
        />
      ) : null}
    </div>
  );
}
