"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Search, Link2, Unplug, Plus, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchJamesproRelations,
  linkCompanyRelation,
  unlinkCompanyRelation,
  createAndLinkRelation,
} from "@/lib/jamespro/actions";
import type { JamesproCompany } from "@/lib/jamespro/client";

export function CompanyJamespro({
  companyId,
  companyName,
  linkedId,
  connected,
}: {
  companyId: string;
  companyName: string;
  linkedId: number | null;
  connected: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(companyName);
  const [results, setResults] = useState<JamesproCompany[] | null>(null);

  function search() {
    startTransition(async () => {
      const res = await searchJamesproRelations(query);
      if (res.ok) setResults(res.results ?? []);
      else toast.error(res.error ?? "Zoeken mislukt");
    });
  }

  function link(id: number, name: string) {
    startTransition(async () => {
      await linkCompanyRelation(companyId, id);
      toast.success(`Gekoppeld aan ${name}`);
    });
  }

  function unlink() {
    startTransition(async () => {
      await unlinkCompanyRelation(companyId);
      toast.success("Ontkoppeld");
      setResults(null);
    });
  }

  function createNew() {
    startTransition(async () => {
      const res = await createAndLinkRelation(companyId, companyName);
      if (res.ok) toast.success("Relatie aangemaakt en gekoppeld");
      else toast.error(res.error ?? "Aanmaken mislukt");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">JamesPRO-relatie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Verbind Alvasi eerst met JamesPRO op de{" "}
            <Link href="/admin/integrations" className="font-medium underline">
              Integraties-pagina
            </Link>
            .
          </p>
        ) : linkedId ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              Gekoppeld aan JamesPRO-relatie #{linkedId}. Bestellingen van dit
              bedrijf worden op deze relatie geboekt.
            </div>
            <Button
              variant="ghost"
              onClick={unlink}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
            >
              <Unplug className="h-4 w-4" /> Ontkoppelen
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Zoek de relatie in JamesPRO op naam en koppel deze, zodat orders
              altijd bij het juiste bedrijf terechtkomen.
            </p>
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Naam van de relatie"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
              />
              <Button variant="outline" onClick={search} disabled={pending}>
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Zoeken
              </Button>
            </div>

            {results !== null ? (
              results.length > 0 ? (
                <ul className="divide-y rounded-lg border">
                  {results.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          #{r.id}
                          {r.client ? " · klant" : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => link(r.id, r.name)}
                        disabled={pending}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Koppelen
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Geen relaties gevonden voor “{query}”.
                </p>
              )
            ) : null}

            <div className="border-t pt-3">
              <Button
                variant="outline"
                onClick={createNew}
                disabled={pending}
              >
                <Plus className="h-4 w-4" /> Nieuwe relatie aanmaken in JamesPRO
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
