"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Inbox, Shield, Users } from "lucide-react";
import { NewUserDialog } from "@/components/user-dialogs";
import { cn } from "@/lib/utils";
import type { PersoneelData } from "@/lib/personeel/data";
import { BestelregelsBar } from "./bestelregels";
import { PeopleTab } from "./people-tab";
import { PersonDrawer } from "./person-drawer";
import { RolesTab } from "./roles-tab";
import { RoleDrawer } from "./role-drawer";
import { MonthTab } from "./month-tab";
import type { Perms } from "./helpers";

export type WorkspaceTab = "medewerkers" | "functies" | "overzicht";

export function PersoneelWorkspace({
  data,
  perms,
  currentUserId,
  previewBase,
  approvalsHref,
  initial,
  header = true,
  tabParam = "tab",
}: {
  data: PersoneelData;
  perms: Perms;
  currentUserId: string;
  /** Prefix for "Bekijk de winkel als", the user id is appended. */
  previewBase: string;
  approvalsHref?: string;
  initial: { tab?: string; persoon?: string; functie?: string };
  header?: boolean;
  /** Query key for the inner tab (the superadmin page uses "tab" itself). */
  tabParam?: string;
}) {
  const showMonth = perms.view || perms.settings;
  const [tab, setTab] = useState<WorkspaceTab>(
    initial.tab === "overzicht" && showMonth
      ? "overzicht"
      : initial.tab === "functies" || (!perms.view && !initial.persoon)
        ? "functies"
        : "medewerkers",
  );
  const [personId, setPersonId] = useState<string | null>(initial.persoon ?? null);
  const [roleId, setRoleId] = useState<string | null>(initial.functie ?? null);

  // Keep the URL shareable without a server round trip.
  function sync(next: { tab?: WorkspaceTab; persoon?: string | null; functie?: string | null }) {
    const url = new URL(window.location.href);
    const set = (k: string, v: string | null | undefined) =>
      v ? url.searchParams.set(k, v) : url.searchParams.delete(k);
    if (next.tab) set(tabParam, next.tab === "medewerkers" ? null : next.tab);
    if ("persoon" in next) set("persoon", next.persoon);
    if ("functie" in next) set("functie", next.functie);
    window.history.replaceState(null, "", url.toString());
  }

  function switchTab(t: WorkspaceTab) {
    setTab(t);
    sync({ tab: t });
  }
  function openPerson(id: string | null) {
    setPersonId(id);
    if (id) setRoleId(null);
    sync({ persoon: id, ...(id ? { functie: null } : {}) });
  }
  function openRole(id: string | null) {
    setRoleId(id);
    if (id) setPersonId(null);
    sync({ functie: id, ...(id ? { persoon: null } : {}) });
  }

  const person = personId ? data.people.find((p) => p.id === personId) : undefined;
  const role = roleId ? data.roles.find((r) => r.id === roleId) : undefined;

  const tabs: { key: WorkspaceTab; label: string; count?: number; icon: typeof Users }[] = [
    { key: "medewerkers", label: "Medewerkers", count: data.people.length, icon: Users },
    { key: "functies", label: "Functies", count: data.roles.length, icon: Shield },
    ...(showMonth
      ? [{ key: "overzicht" as const, label: "Maandoverzicht", icon: CalendarDays }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {header ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Personeel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Medewerkers, functies, budgetten en wat iedereen in de winkel ziet.
            </p>
          </div>
          {perms.invite ? (
            <NewUserDialog
              companyId={data.companyId}
              roles={data.roles.map((r) => ({ id: r.id, name: r.name }))}
            />
          ) : null}
        </div>
      ) : perms.invite ? (
        <div className="flex justify-end">
          <NewUserDialog
            companyId={data.companyId}
            roles={data.roles.map((r) => ({ id: r.id, name: r.name }))}
          />
        </div>
      ) : null}

      <BestelregelsBar data={data} canEdit={perms.settings} />

      {data.pendingRequests > 0 && approvalsHref ? (
        <Link
          href={approvalsHref}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 hover:bg-amber-100"
        >
          <Inbox className="h-4 w-4" />
          {data.pendingRequests === 1
            ? "1 budgetaanvraag wacht op een beslissing"
            : `${data.pendingRequests} budgetaanvragen wachten op een beslissing`}
          <span className="ml-auto font-medium">Bekijken</span>
        </Link>
      ) : null}

      <div role="tablist" className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[15px] font-medium transition",
              tab === t.key
                ? "border-[var(--brand)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count != null ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "medewerkers" ? (
        <PeopleTab data={data} perms={perms} currentUserId={currentUserId} onOpen={openPerson} />
      ) : tab === "functies" ? (
        <RolesTab data={data} perms={perms} onOpen={openRole} />
      ) : (
        <MonthTab data={data} approvalsHref={approvalsHref} onOpenPerson={openPerson} />
      )}

      {person ? (
        <PersonDrawer
          data={data}
          person={person}
          perms={perms}
          currentUserId={currentUserId}
          previewHref={`${previewBase}${person.id}`}
          onClose={() => openPerson(null)}
        />
      ) : null}
      {role ? (
        <RoleDrawer
          data={data}
          role={role}
          perms={perms}
          onClose={() => openRole(null)}
          onOpenPerson={openPerson}
        />
      ) : null}
    </div>
  );
}
